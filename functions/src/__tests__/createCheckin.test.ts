import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {DecodedIdToken} from "firebase-admin/auth";

import {
  makeQuerySnapshot,
  mockBatch,
  mockFieldValue,
  mockFirestoreInstance,
  resetAllMocks,
} from "./helpers/firebaseAdminMock";
import {createCheckin} from "../createCheckin";

type CreateCheckinRunRequest = Parameters<typeof createCheckin.run>[0];
type CreateCheckinRunResult = Awaited<ReturnType<typeof createCheckin.run>>;

interface TestDocumentRef {
  id: string;
  path: string;
}

const CHECKIN_DURATION_MS = 2 * 60 * 60 * 1000;
const FIXED_NOW_MS = Date.UTC(2026, 5, 29, 5, 0, 0);
const GENERATED_CHECKIN_ID = "generated-checkin-id";

const validPayload = {
  city: "Kuala Lumpur",
  gymName: "KL Strength Club",
  latitude: 3.1478,
  longitude: 101.6953,
  placeId: "places/fitlink-kl-strength",
};

const createDocumentRef = (path: string, id: string): TestDocumentRef => {
  return {id, path};
};

const createGymCheckinsCollection = (checkinRef: TestDocumentRef) => {
  const collection = {
    doc: jest.fn((): TestDocumentRef => checkinRef),
    get: jest.fn<() => Promise<unknown>>(),
    limit: jest.fn<(...args: unknown[]) => unknown>(),
    where: jest.fn<(...args: unknown[]) => unknown>(),
  };

  collection.where.mockReturnValue(collection);
  collection.limit.mockReturnValue(collection);
  collection.get.mockResolvedValue(makeQuerySnapshot([]));

  return collection;
};

const createUsersCollection = () => {
  return {
    doc: jest.fn((uid: unknown): TestDocumentRef => {
      const documentId = typeof uid === "string" ? uid : "unknown";
      return createDocumentRef(`users/${documentId}`, documentId);
    }),
  };
};

type GymCheckinsCollection = ReturnType<typeof createGymCheckinsCollection>;
type UsersCollection = ReturnType<typeof createUsersCollection>;

let gymCheckinsCollection: GymCheckinsCollection;
let usersCollection: UsersCollection;

const installCollectionAwareFirestore = (): void => {
  mockFirestoreInstance.collection.mockImplementation(
    (path: unknown): unknown => {
      if (path === "gymCheckins") {
        return gymCheckinsCollection;
      }

      if (path === "users") {
        return usersCollection;
      }

      return undefined;
    }
  );
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
): CreateCheckinRunRequest => {
  const request = {
    auth: uid === null ? null : {uid, token: makeDecodedToken(uid)},
    data,
    rawRequest: {},
  };

  // CallableRequest includes framework-owned fields not relevant to direct .run tests.
  return request as unknown as CreateCheckinRunRequest;
};

const callCreateCheckin = (
  request: CreateCheckinRunRequest
): Promise<CreateCheckinRunResult> => {
  return createCheckin.run(request);
};

const makeTimestampExpectation = (ms: number): unknown => {
  return expect.objectContaining({
    nanoseconds: (ms % 1000) * 1000000,
    seconds: Math.floor(ms / 1000),
  });
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
  gymCheckinsCollection = createGymCheckinsCollection(
    createDocumentRef(
      `gymCheckins/${GENERATED_CHECKIN_ID}`,
      GENERATED_CHECKIN_ID
    )
  );
  usersCollection = createUsersCollection();
  installCollectionAwareFirestore();
});

afterEach(() => {
  if (restoreDateNow !== null) {
    restoreDateNow();
    restoreDateNow = null;
  }
});

describe("createCheckin", () => {
  it("throws unauthenticated when request.auth is null", async () => {
    await expect(
      callCreateCheckin(makeRequest(null, validPayload))
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws already-exists when the gymCheckins query finds an active check-in", async () => {
    pinDateNow(FIXED_NOW_MS);
    gymCheckinsCollection.get.mockResolvedValue(
      makeQuerySnapshot([
        {
          data: (): Record<string, unknown> => ({
            userId: "user1",
          }),
          id: "active-checkin",
        },
      ])
    );

    await expect(
      callCreateCheckin(makeRequest("user1", validPayload))
    ).rejects.toMatchObject({
      code: "already-exists",
    });
  });

  it("throws invalid-argument when required payload fields are missing", async () => {
    const invalidPayload = {
      city: validPayload.city,
      gymName: validPayload.gymName,
      latitude: validPayload.latitude,
      longitude: validPayload.longitude,
    };

    await expect(
      callCreateCheckin(makeRequest("user1", invalidPayload))
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockFirestoreInstance.collection).not.toHaveBeenCalled();
  });

  it("writes a gymCheckins document and user denorm in a batch for a valid check-in", async () => {
    pinDateNow(FIXED_NOW_MS);
    const expectedExpiresAtMs = FIXED_NOW_MS + CHECKIN_DURATION_MS;

    const result = await callCreateCheckin(
      makeRequest("user1", validPayload)
    );

    expect(mockFirestoreInstance.collection).toHaveBeenCalledWith(
      "gymCheckins"
    );
    expect(gymCheckinsCollection.where).toHaveBeenNthCalledWith(
      1,
      "userId",
      "==",
      "user1"
    );
    expect(gymCheckinsCollection.where).toHaveBeenNthCalledWith(
      2,
      "expiresAt",
      ">",
      makeTimestampExpectation(FIXED_NOW_MS)
    );
    expect(gymCheckinsCollection.limit).toHaveBeenCalledWith(1);
    expect(mockFirestoreInstance.batch).toHaveBeenCalledTimes(1);
    expect(mockFirestoreInstance.runTransaction).not.toHaveBeenCalled();
    expect(mockFirestoreInstance.writeBatch).not.toHaveBeenCalled();
    expect(mockBatch.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: GENERATED_CHECKIN_ID,
        path: `gymCheckins/${GENERATED_CHECKIN_ID}`,
      }),
      expect.objectContaining({
        checkedInAt: expect.objectContaining({
          _methodName: "serverTimestamp",
        }),
        city: validPayload.city,
        coordinates: expect.objectContaining({
          latitude: validPayload.latitude,
          longitude: validPayload.longitude,
        }),
        expiresAt: makeTimestampExpectation(expectedExpiresAtMs),
        gymName: validPayload.gymName,
        placeId: validPayload.placeId,
        userId: "user1",
      })
    );
    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user1",
        path: "users/user1",
      }),
      {
        gymCheckin: {
          expiresAt: makeTimestampExpectation(expectedExpiresAtMs),
          gymName: validPayload.gymName,
        },
      }
    );
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockFieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(result.checkinId).toBe(GENERATED_CHECKIN_ID);
    expect(result.expiresAt.toMillis()).toBe(expectedExpiresAtMs);
  });
});
