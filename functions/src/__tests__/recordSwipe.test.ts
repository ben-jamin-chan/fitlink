import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {DecodedIdToken} from "firebase-admin/auth";

import {
  makeDocSnapshot,
  mockFirestoreInstance,
  mockTimestamp,
  mockTransaction,
  resetAllMocks,
} from "./helpers/firebaseAdminMock";
import {recordSwipe} from "../recordSwipe";

type RecordSwipeRunRequest = Parameters<typeof recordSwipe.run>[0];
type RecordSwipeRunResult = Awaited<ReturnType<typeof recordSwipe.run>>;

const FREE_DAILY_LIMIT = 50;
const FUTURE_RESET_MS = Date.now() + 24 * 60 * 60 * 1000;
const PAST_RESET_MS = Date.now() - 60 * 1000;

const documentData = new Map<string, Record<string, unknown> | null>();

const getDocumentId = (path: string): string => {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? "mock-doc-id";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
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
    set: jest.fn(async (data: unknown): Promise<void> => {
      documentData.set(path, isRecord(data) ? data : null);
    }),
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

const getRefPath = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.path !== "string") {
    return null;
  }

  return value.path;
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

const makeRequest = (
  uid: string | null,
  data: Record<string, unknown>
): RecordSwipeRunRequest => {
  const request = {
    auth: uid === null ? null : {uid, token: makeDecodedToken(uid)},
    data,
    rawRequest: {},
  };

  // The callable type exposes the source file's already-narrowed data shape,
  // but these tests intentionally pass raw client payloads through validation.
  return request as unknown as RecordSwipeRunRequest;
};

const callRecordSwipe = (
  request: RecordSwipeRunRequest
): Promise<RecordSwipeRunResult> => {
  return recordSwipe.run(request);
};

const setUserData = (uid: string, isPremium: boolean): void => {
  documentData.set(`users/${uid}`, {
    premium: {
      active: isPremium,
    },
    timezone: "Asia/Kuala_Lumpur",
  });
};

const setMissingTargetUser = (uid: string): void => {
  documentData.set(`users/${uid}`, null);
};

const stubDailyLikes = (count: number, resetAtMs: number): void => {
  mockTransaction.get.mockImplementation(async (ref: unknown): Promise<unknown> => {
    if (getRefPath(ref) === "users/user1/dailyLikes/doc") {
      return makeDocSnapshot({
        count,
        resetAt: mockTimestamp.fromMillis(resetAtMs),
      });
    }

    return makeDocSnapshot(null);
  });
};

beforeEach(() => {
  resetAllMocks();
  documentData.clear();
  documentRefs.clear();
  installPathAwareFirestore();
  setUserData("user1", false);
  setMissingTargetUser("user2");
});

describe("recordSwipe", () => {
  it("throws unauthenticated when request.auth is null", async () => {
    const request = makeRequest(null, {
      targetId: "user2",
      direction: "like",
    });

    await expect(callRecordSwipe(request)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws invalid-argument for an unrecognised direction", async () => {
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "rewind",
    });

    await expect(callRecordSwipe(request)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("records a pass without touching dailyLikes", async () => {
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "pass",
    });

    const result = await callRecordSwipe(request);

    expect(getDocumentRef("swipes/user1/passes/user2").set).toHaveBeenCalledWith(
      expect.objectContaining({
        swiperId: "user1",
        targetId: "user2",
      })
    );
    expect(mockFirestoreInstance.runTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.get).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      remainingLikes: FREE_DAILY_LIMIT,
    });
  });

  it("records a like and returns correct remainingLikes for a free user under limit", async () => {
    stubDailyLikes(10, FUTURE_RESET_MS);
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "like",
    });

    const result = await callRecordSwipe(request);

    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("users/user1/dailyLikes/doc"),
      expect.objectContaining({
        count: 11,
      }),
      {merge: true}
    );
    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("swipes/user1/likes/user2"),
      expect.objectContaining({
        swiperId: "user1",
        targetId: "user2",
        isSuperLike: false,
      })
    );
    expect(result).toMatchObject({
      success: true,
      remainingLikes: FREE_DAILY_LIMIT - 11,
    });
  });

  it("throws resource-exhausted when free user has reached the daily like limit", async () => {
    stubDailyLikes(FREE_DAILY_LIMIT, FUTURE_RESET_MS);
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "like",
    });

    await expect(callRecordSwipe(request)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  it("records a like without limit enforcement for a premium user", async () => {
    setUserData("user1", true);
    stubDailyLikes(FREE_DAILY_LIMIT, FUTURE_RESET_MS);
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "like",
    });

    const result = await callRecordSwipe(request);

    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("swipes/user1/likes/user2"),
      expect.objectContaining({
        swiperId: "user1",
        targetId: "user2",
        isSuperLike: false,
      })
    );
    expect(result).toMatchObject({
      success: true,
      remainingLikes: Number.MAX_SAFE_INTEGER,
    });
  });

  it("throws permission-denied when a free user attempts a superlike", async () => {
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "superlike",
    });

    await expect(callRecordSwipe(request)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("records a superlike with isSuperLike: true for a premium user", async () => {
    setUserData("user1", true);
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "superlike",
    });

    const result = await callRecordSwipe(request);

    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("swipes/user1/likes/user2"),
      expect.objectContaining({
        swiperId: "user1",
        targetId: "user2",
        isSuperLike: true,
      })
    );
    expect(result).toMatchObject({
      success: true,
      remainingLikes: Number.MAX_SAFE_INTEGER,
    });
  });

  it("treats a past resetAt as a fresh count of 0 and allows the like", async () => {
    stubDailyLikes(FREE_DAILY_LIMIT, PAST_RESET_MS);
    const request = makeRequest("user1", {
      targetId: "user2",
      direction: "like",
    });

    const result = await callRecordSwipe(request);

    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("users/user1/dailyLikes/doc"),
      expect.objectContaining({
        count: 1,
      }),
      {merge: true}
    );
    expect(mockTransaction.set).toHaveBeenCalledWith(
      getDocumentRef("swipes/user1/likes/user2"),
      expect.objectContaining({
        swiperId: "user1",
        targetId: "user2",
        isSuperLike: false,
      })
    );
    expect(result).toMatchObject({
      success: true,
      remainingLikes: FREE_DAILY_LIMIT - 1,
    });
  });
});
