import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {DecodedIdToken} from "firebase-admin/auth";

import {
  makeDocSnapshot,
  mockFieldValue,
  mockFirestoreInstance,
  mockTimestamp,
  resetAllMocks,
} from "./helpers/firebaseAdminMock";
import {activateBoost} from "../activateBoost";

type ActivateBoostRunRequest = Parameters<typeof activateBoost.run>[0];
type ActivateBoostRunResult = Awaited<ReturnType<typeof activateBoost.run>>;

const BOOST_DURATION_MS = 30 * 60 * 1000;
const FIXED_NOW_MS = Date.UTC(2026, 5, 29, 4, 0, 0);

const documentData = new Map<string, Record<string, unknown> | null>();

const getDocumentId = (path: string): string => {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? "mock-doc-id";
};

const createDocumentRef = (path: string) => {
  return {
    path,
    get: jest.fn(async (): Promise<unknown> => {
      return makeDocSnapshot(
        documentData.get(path) ?? null,
        getDocumentId(path)
      );
    }),
    update: jest.fn(async (): Promise<void> => undefined),
  };
};

type TestDocumentRef = ReturnType<typeof createDocumentRef>;

const documentRefs = new Map<string, TestDocumentRef>();

const getDocumentRef = (path: string): TestDocumentRef => {
  const existingRef = documentRefs.get(path);
  if (existingRef !== undefined) {
    return existingRef;
  }

  const ref = createDocumentRef(path);
  documentRefs.set(path, ref);
  return ref;
};

const installPathAwareFirestore = (): void => {
  mockFirestoreInstance.doc.mockImplementation((path: unknown): unknown => {
    return getDocumentRef(typeof path === "string" ? path : "unknown");
  });
};

const makeDecodedToken = (uid: string): DecodedIdToken => {
  return {
    aud: "test-project",
    auth_time: 0,
    exp: 9999999999,
    firebase: {
      identities: {},
      sign_in_provider: "custom",
    },
    iat: 0,
    iss: "https://securetoken.google.com/test-project",
    sub: uid,
    uid,
  };
};

const makeRequest = (uid: string | null): ActivateBoostRunRequest => {
  const request = {
    auth: uid === null ? null : {uid, token: makeDecodedToken(uid)},
    data: {},
    rawRequest: {},
  };

  // CallableRequest includes framework-owned fields not relevant to direct .run tests.
  return request as unknown as ActivateBoostRunRequest;
};

const callActivateBoost = (
  request: ActivateBoostRunRequest
): Promise<ActivateBoostRunResult> => {
  return activateBoost.run(request);
};

const setUserData = (
  uid: string,
  data: Record<string, unknown> | null
): void => {
  documentData.set(`users/${uid}`, data);
};

const makeProUserData = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => {
  return {
    premium: {
      active: true,
      tier: "pro",
    },
    ...overrides,
  };
};

const makeTimestampExpectation = (ms: number): unknown => {
  return expect.objectContaining({
    nanoseconds: (ms % 1000) * 1000000,
    seconds: Math.floor(ms / 1000),
  });
};

const getCurrentMonthTimestamp = (): unknown => {
  const now = new Date();
  const currentMonthMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    12,
    0,
    0
  ).getTime();

  return mockTimestamp.fromMillis(currentMonthMs);
};

const getPreviousMonthTimestamp = (): unknown => {
  const now = new Date();
  const previousMonthMs = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
    12,
    0,
    0
  ).getTime();

  return mockTimestamp.fromMillis(previousMonthMs);
};

let restoreDateNow: (() => void) | null = null;

const pinDateNow = (ms: number): void => {
  const spy = jest.spyOn(Date, "now").mockReturnValue(ms);
  restoreDateNow = (): void => {
    spy.mockRestore();
  };
};

beforeEach(() => {
  resetAllMocks();
  documentData.clear();
  documentRefs.clear();
  installPathAwareFirestore();
  setUserData("user1", makeProUserData());
});

afterEach(() => {
  if (restoreDateNow !== null) {
    restoreDateNow();
    restoreDateNow = null;
  }
});

describe("activateBoost", () => {
  it("throws unauthenticated when request.auth is null", async () => {
    await expect(callActivateBoost(makeRequest(null))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the user is not a Pro subscriber", async () => {
    setUserData("user1", {
      premium: {
        active: false,
      },
    });

    await expect(callActivateBoost(makeRequest("user1"))).rejects.toMatchObject(
      {
        code: "permission-denied",
      }
    );
  });

  it("throws resource-exhausted when a boost was activated this calendar month", async () => {
    // ARCHITECT NOTE: source enforces one boost per calendar month via
    // boost.activatedAt and throws resource-exhausted, not already-exists.
    setUserData(
      "user1",
      makeProUserData({
        boost: {
          activatedAt: getCurrentMonthTimestamp(),
          expiresAt: mockTimestamp.fromMillis(FIXED_NOW_MS + BOOST_DURATION_MS),
        },
      })
    );

    await expect(callActivateBoost(makeRequest("user1"))).rejects.toMatchObject(
      {
        code: "resource-exhausted",
      }
    );
  });

  it("writes a nested boost and returns success for a Pro user with no boost", async () => {
    pinDateNow(FIXED_NOW_MS);

    const result = await callActivateBoost(makeRequest("user1"));

    expect(getDocumentRef("users/user1").update).toHaveBeenCalledWith({
      boost: {
        activatedAt: expect.objectContaining({
          _methodName: "serverTimestamp",
        }),
        expiresAt: makeTimestampExpectation(FIXED_NOW_MS + BOOST_DURATION_MS),
      },
    });
    expect(mockFieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      expiresAt: FIXED_NOW_MS + BOOST_DURATION_MS,
      success: true,
    });
  });

  it("allows a Pro user to activate again when the previous boost was in a prior month", async () => {
    pinDateNow(FIXED_NOW_MS);
    setUserData(
      "user1",
      makeProUserData({
        boost: {
          activatedAt: getPreviousMonthTimestamp(),
          expiresAt: mockTimestamp.fromMillis(FIXED_NOW_MS - 1000),
        },
      })
    );

    const result = await callActivateBoost(makeRequest("user1"));

    expect(getDocumentRef("users/user1").update).toHaveBeenCalledWith({
      boost: {
        activatedAt: expect.objectContaining({
          _methodName: "serverTimestamp",
        }),
        expiresAt: makeTimestampExpectation(FIXED_NOW_MS + BOOST_DURATION_MS),
      },
    });
    expect(result).toEqual({
      expiresAt: FIXED_NOW_MS + BOOST_DURATION_MS,
      success: true,
    });
  });
});
