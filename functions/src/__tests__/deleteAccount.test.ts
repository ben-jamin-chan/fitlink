import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {DecodedIdToken} from "firebase-admin/auth";

import {
  makeDocSnapshot,
  mockAuthInstance,
  mockBatch,
  mockBucket,
  mockDatabaseRef,
  mockDatabaseInstance,
  mockFirestoreInstance,
  resetAllMocks,
} from "./helpers/firebaseAdminMock";
import {
  mockStripeConstructor,
  mockStripeSubscriptions,
  resetStripeMocks,
} from "./helpers/stripeMock";
import {deleteAccount} from "../deleteAccount";

type DeleteAccountRunRequest = Parameters<typeof deleteAccount.run>[0];
type DeleteAccountRunResult = Awaited<ReturnType<typeof deleteAccount.run>>;

interface CallOrderMock {
  mock: {
    invocationCallOrder: number[];
  };
}

interface TestDocumentRef {
  id: string;
  path: string;
  get: jest.Mock<() => Promise<unknown>>;
  delete: jest.Mock<() => Promise<void>>;
}

interface TestQueryDocument {
  id: string;
  ref: TestDocumentRef;
  data: () => Record<string, unknown>;
}

interface TestQuerySnapshot {
  docs: TestQueryDocument[];
  empty: boolean;
  size: number;
}

interface TestCollectionRef {
  path: string;
  get: jest.Mock<() => Promise<TestQuerySnapshot>>;
  listDocuments: jest.Mock<() => Promise<TestDocumentRef[]>>;
  where: jest.Mock<(...args: unknown[]) => TestCollectionRef>;
}

interface TestFile {
  path: string;
  delete: jest.Mock<() => Promise<void>>;
}

const uid = "user1";
const stripeCustomerId = "cus_test_user1";
const activeSubscriptionId = "sub_active_user1";

const documentData = new Map<string, Record<string, unknown> | null>();
const documentRefs = new Map<string, TestDocumentRef>();
const collectionRefs = new Map<string, TestCollectionRef>();
const subcollectionRefs = new Map<string, TestDocumentRef[]>();
const queryDocs = new Map<string, TestQueryDocument[]>();

let storageFiles: TestFile[] = [];

const getDocumentId = (path: string): string => {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? "mock-doc-id";
};

const makeQuerySnapshot = (
  docs: readonly TestQueryDocument[]
): TestQuerySnapshot => {
  return {
    docs: [...docs],
    empty: docs.length === 0,
    size: docs.length,
  };
};

const createDocumentRef = (path: string): TestDocumentRef => {
  return {
    id: getDocumentId(path),
    path,
    get: jest.fn(async (): Promise<unknown> => {
      return makeDocSnapshot(
        documentData.get(path) ?? null,
        getDocumentId(path)
      );
    }),
    delete: jest.fn(async (): Promise<void> => undefined),
  };
};

const getDocumentRef = (path: string): TestDocumentRef => {
  const existingRef = documentRefs.get(path);
  if (existingRef !== undefined) {
    return existingRef;
  }

  const ref = createDocumentRef(path);
  documentRefs.set(path, ref);
  return ref;
};

const createCollectionRef = (path: string): TestCollectionRef => {
  const collection: TestCollectionRef = {
    path,
    get: jest.fn(async (): Promise<TestQuerySnapshot> => {
      return makeQuerySnapshot(queryDocs.get(path) ?? []);
    }),
    listDocuments: jest.fn(async (): Promise<TestDocumentRef[]> => {
      return subcollectionRefs.get(path) ?? [];
    }),
    where: jest.fn<(...args: unknown[]) => TestCollectionRef>(),
  };

  collection.where.mockReturnValue(collection);

  return collection;
};

const getCollectionRef = (path: string): TestCollectionRef => {
  const existingRef = collectionRefs.get(path);
  if (existingRef !== undefined) {
    return existingRef;
  }

  const collection = createCollectionRef(path);
  collectionRefs.set(path, collection);
  return collection;
};

const installPathAwareFirestore = (): void => {
  mockFirestoreInstance.doc.mockImplementation((path: unknown): unknown => {
    return getDocumentRef(typeof path === "string" ? path : "unknown");
  });
  mockFirestoreInstance.collection.mockImplementation(
    (path: unknown): unknown => {
      return getCollectionRef(typeof path === "string" ? path : "unknown");
    }
  );
};

const makeDecodedToken = (userId: string): DecodedIdToken => {
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
    sub: userId,
    uid: userId,
  };
};

const makeRequest = (userId: string | null): DeleteAccountRunRequest => {
  const request = {
    auth: userId === null ? null : {uid: userId, token: makeDecodedToken(userId)},
    data: {},
    rawRequest: {},
  };

  // CallableRequest includes framework-owned fields not relevant to direct .run tests.
  return request as unknown as DeleteAccountRunRequest;
};

const callDeleteAccount = (
  request: DeleteAccountRunRequest
): Promise<DeleteAccountRunResult> => {
  return deleteAccount.run(request);
};

const setUserData = (
  data: Record<string, unknown> | null
): void => {
  documentData.set(`users/${uid}`, data);
};

const createQueryDocument = (
  collectionPath: string,
  documentId: string
): TestQueryDocument => {
  return {
    id: documentId,
    ref: getDocumentRef(`${collectionPath}/${documentId}`),
    data: (): Record<string, unknown> => ({id: documentId}),
  };
};

const setSubcollectionDocuments = (
  collectionPath: string,
  documentIds: readonly string[]
): void => {
  subcollectionRefs.set(
    collectionPath,
    documentIds.map((documentId) => {
      return getDocumentRef(`${collectionPath}/${documentId}`);
    })
  );
};

const setMatchDocuments = (documentIds: readonly string[]): void => {
  queryDocs.set(
    "matches",
    documentIds.map((documentId) => {
      return createQueryDocument("matches", documentId);
    })
  );
};

const setCheckinDocuments = (documentIds: readonly string[]): void => {
  queryDocs.set(
    "gymCheckins",
    documentIds.map((documentId) => {
      return createQueryDocument("gymCheckins", documentId);
    })
  );
};

const createStorageFile = (path: string): TestFile => {
  return {
    path,
    delete: jest.fn(async (): Promise<void> => undefined),
  };
};

const seedDeletionTargets = (): void => {
  setSubcollectionDocuments(`users/${uid}/dailyLikes`, ["doc"]);
  setSubcollectionDocuments(`users/${uid}/notificationPreferences`, ["prefs"]);
  setSubcollectionDocuments(`users/${uid}/warnings`, ["warning1"]);
  setSubcollectionDocuments(`swipes/${uid}/likes`, ["likedUser"]);
  setSubcollectionDocuments(`swipes/${uid}/passes`, ["passedUser"]);
  setMatchDocuments(["match1"]);
  setCheckinDocuments(["checkin1"]);
  storageFiles = [createStorageFile(`users/${uid}/photos/0.jpg`)];
  mockBucket.getFiles.mockResolvedValue([storageFiles]);
};

const getLastCallOrder = (mockFn: CallOrderMock): number => {
  const orders = mockFn.mock.invocationCallOrder;
  return orders.length > 0 ? Math.max(...orders) : 0;
};

const expectAuthDeletionAfter = (
  mocks: readonly CallOrderMock[]
): void => {
  const authDeleteOrder = getLastCallOrder(mockAuthInstance.deleteUser);

  expect(authDeleteOrder).toBeGreaterThan(0);
  mocks.forEach((mockFn) => {
    expect(authDeleteOrder).toBeGreaterThan(getLastCallOrder(mockFn));
  });
};

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_delete_account";
  resetAllMocks();
  resetStripeMocks();
  documentData.clear();
  documentRefs.clear();
  collectionRefs.clear();
  subcollectionRefs.clear();
  queryDocs.clear();
  storageFiles = [];
  installPathAwareFirestore();
  setUserData({
    stripeCustomerId,
  });
  mockStripeSubscriptions.list.mockImplementation(
    async (): Promise<unknown> => ({data: []})
  );
  mockStripeSubscriptions.update.mockImplementation(
    async (): Promise<unknown> => ({})
  );
});

describe("deleteAccount", () => {
  it("throws unauthenticated when request.auth is null", async () => {
    await expect(callDeleteAccount(makeRequest(null))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("skips Stripe when the user has no stripeCustomerId and still deletes account data", async () => {
    setUserData({});
    seedDeletionTargets();

    const result = await callDeleteAccount(makeRequest(uid));

    expect(mockStripeConstructor).not.toHaveBeenCalled();
    expect(mockStripeSubscriptions.list).not.toHaveBeenCalled();
    expect(getCollectionRef(`users/${uid}/dailyLikes`).listDocuments)
      .toHaveBeenCalledTimes(1);
    expect(getCollectionRef(`users/${uid}/notificationPreferences`)
      .listDocuments).toHaveBeenCalledTimes(1);
    expect(getCollectionRef(`users/${uid}/warnings`).listDocuments)
      .toHaveBeenCalledTimes(1);
    expect(getDocumentRef(`users/${uid}`).delete).toHaveBeenCalledTimes(1);
    expect(getCollectionRef(`swipes/${uid}/likes`).listDocuments)
      .toHaveBeenCalledTimes(1);
    expect(getCollectionRef(`swipes/${uid}/passes`).listDocuments)
      .toHaveBeenCalledTimes(1);
    expect(getDocumentRef(`swipes/${uid}`).delete).toHaveBeenCalledTimes(1);
    expect(getCollectionRef("matches").where).toHaveBeenCalledWith(
      "users",
      "array-contains",
      uid
    );
    expect(getCollectionRef("gymCheckins").where).toHaveBeenCalledWith(
      "userId",
      "==",
      uid
    );
    expect(mockBucket.getFiles).toHaveBeenCalledWith({
      prefix: `users/${uid}/`,
    });
    expect(storageFiles[0]?.delete).toHaveBeenCalledTimes(1);
    expect(mockDatabaseInstance.ref).toHaveBeenCalledWith("chats/match1");
    expect(mockDatabaseRef.remove).toHaveBeenCalledTimes(1);
    expect(mockAuthInstance.deleteUser).toHaveBeenCalledWith(uid);
    expectAuthDeletionAfter([
      mockBatch.delete,
      mockBatch.commit,
      getDocumentRef(`users/${uid}`).delete,
      getDocumentRef(`swipes/${uid}`).delete,
      storageFiles[0]?.delete ?? mockBatch.delete,
      mockDatabaseRef.remove,
    ]);
    expect(result).toEqual({success: true});
  });

  it("cancels an active Stripe subscription at period end", async () => {
    mockStripeSubscriptions.list.mockImplementation(
      async (): Promise<unknown> => ({
        data: [{id: activeSubscriptionId}],
      })
    );

    await callDeleteAccount(makeRequest(uid));

    expect(mockStripeSubscriptions.list).toHaveBeenCalledWith({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });
    expect(mockStripeSubscriptions.update).toHaveBeenCalledWith(
      activeSubscriptionId,
      {cancel_at_period_end: true}
    );
    expect(mockStripeSubscriptions.update).not.toHaveBeenCalledWith(
      activeSubscriptionId,
      expect.objectContaining({cancel_immediately: true})
    );
    expect(mockStripeSubscriptions.cancel).not.toHaveBeenCalled();
  });

  it("swallows Stripe list failures and still deletes the auth user", async () => {
    mockStripeSubscriptions.list.mockImplementation(async (): Promise<never> => {
      throw new Error("Stripe unavailable");
    });

    const result = await callDeleteAccount(makeRequest(uid));

    expect(mockStripeSubscriptions.list).toHaveBeenCalledTimes(1);
    expect(mockAuthInstance.deleteUser).toHaveBeenCalledWith(uid);
    expect(result).toEqual({success: true});
  });

  it("deletes all services and Firebase Auth last on the full happy path", async () => {
    seedDeletionTargets();
    mockStripeSubscriptions.list.mockImplementation(
      async (): Promise<unknown> => ({
        data: [{id: activeSubscriptionId}],
      })
    );

    const result = await callDeleteAccount(makeRequest(uid));

    expect(mockStripeSubscriptions.update).toHaveBeenCalledWith(
      activeSubscriptionId,
      {cancel_at_period_end: true}
    );
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef(`users/${uid}/dailyLikes/doc`)
    );
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef(`users/${uid}/notificationPreferences/prefs`)
    );
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef(`users/${uid}/warnings/warning1`)
    );
    expect(getDocumentRef(`users/${uid}`).delete).toHaveBeenCalledTimes(1);
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef(`swipes/${uid}/likes/likedUser`)
    );
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef(`swipes/${uid}/passes/passedUser`)
    );
    expect(getDocumentRef(`swipes/${uid}`).delete).toHaveBeenCalledTimes(1);
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef("matches/match1")
    );
    expect(mockBatch.delete).toHaveBeenCalledWith(
      getDocumentRef("gymCheckins/checkin1")
    );
    expect(storageFiles[0]?.delete).toHaveBeenCalledTimes(1);
    expect(mockDatabaseInstance.ref).toHaveBeenCalledWith("chats/match1");
    expect(mockDatabaseRef.remove).toHaveBeenCalledTimes(1);
    expect(mockAuthInstance.deleteUser).toHaveBeenCalledWith(uid);
    expectAuthDeletionAfter([
      mockStripeSubscriptions.update,
      mockBatch.delete,
      mockBatch.commit,
      getDocumentRef(`users/${uid}`).delete,
      getDocumentRef(`swipes/${uid}`).delete,
      storageFiles[0]?.delete ?? mockBatch.delete,
      mockDatabaseRef.remove,
    ]);
    expect(result).toEqual({success: true});
  });
});
