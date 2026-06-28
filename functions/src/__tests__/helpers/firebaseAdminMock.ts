import {jest} from "@jest/globals";

interface MockDocumentSnapshot {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface MockQueryDocument {
  id: string;
  ref: typeof mockDocRef;
  data: () => Record<string, unknown>;
}

interface MockQuerySnapshot {
  forEach: (cb: (doc: MockQueryDocument) => void) => void;
  docs: MockQueryDocument[];
  empty: boolean;
  size: number;
}

class MockTimestamp {
  static fromMillis = jest.fn((ms: number): MockTimestamp => {
    const seconds = Math.floor(ms / 1000);
    const nanoseconds = (ms % 1000) * 1000000;

    return new MockTimestamp(seconds, nanoseconds);
  });

  static now = jest.fn((): MockTimestamp => {
    return MockTimestamp.fromMillis(Date.now());
  });

  constructor(
    readonly seconds: number,
    readonly nanoseconds: number
  ) {}

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }
}

class MockGeoPoint {
  constructor(
    readonly latitude: number,
    readonly longitude: number
  ) {}
}

export const mockTransaction = {
  get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  set: jest.fn<(...args: unknown[]) => unknown>(),
  update: jest.fn<(...args: unknown[]) => unknown>(),
  delete: jest.fn<(...args: unknown[]) => unknown>(),
};

export const mockBatch = {
  set: jest.fn<(...args: unknown[]) => unknown>(),
  update: jest.fn<(...args: unknown[]) => unknown>(),
  delete: jest.fn<(...args: unknown[]) => unknown>(),
  commit: jest.fn<() => Promise<void>>(),
};

export const mockDocRef = {
  id: "mock-doc-id",
  get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  set: jest.fn<(...args: unknown[]) => Promise<void>>(),
  update: jest.fn<(...args: unknown[]) => Promise<void>>(),
  delete: jest.fn<(...args: unknown[]) => Promise<void>>(),
  collection: jest.fn<(...args: unknown[]) => unknown>(),
};

export const mockQuery = {
  doc: jest.fn<(...args: unknown[]) => unknown>(),
  where: jest.fn<(...args: unknown[]) => unknown>(),
  limit: jest.fn<(...args: unknown[]) => unknown>(),
  orderBy: jest.fn<(...args: unknown[]) => unknown>(),
  get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  listDocuments: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(),
};

type MockTransactionCallback = (
  tx: typeof mockTransaction
) => Promise<unknown> | unknown;

export const mockFirestoreInstance = {
  doc: jest.fn<(...args: unknown[]) => unknown>(),
  collection: jest.fn<(...args: unknown[]) => unknown>(),
  runTransaction: jest.fn<
    (cb: MockTransactionCallback) => Promise<unknown>
  >(),
  writeBatch: jest.fn<(...args: unknown[]) => unknown>(),
  batch: jest.fn<(...args: unknown[]) => unknown>(),
};

export const mockAuthInstance = {
  getUser: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  deleteUser: jest.fn<(...args: unknown[]) => Promise<void>>(),
  setCustomUserClaims: jest.fn<(...args: unknown[]) => Promise<void>>(),
};

export const mockFile = {
  delete: jest.fn<(...args: unknown[]) => Promise<void>>(),
};

export const mockBucket = {
  file: jest.fn<(...args: unknown[]) => unknown>(),
  getFiles: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  deleteFiles: jest.fn<(...args: unknown[]) => Promise<void>>(),
};

export const mockStorageInstance = {
  bucket: jest.fn<(...args: unknown[]) => unknown>(),
};

export const mockDatabaseRef = {
  remove: jest.fn<(...args: unknown[]) => Promise<void>>(),
};

export const mockDatabaseInstance = {
  ref: jest.fn<(...args: unknown[]) => unknown>(),
};

export const mockFieldValue = {
  serverTimestamp: jest.fn((): Record<string, string> => {
    return {_methodName: "serverTimestamp"};
  }),
  delete: jest.fn((): Record<string, string> => {
    return {_methodName: "delete"};
  }),
  arrayUnion: jest.fn((...args: unknown[]): Record<string, unknown> => {
    return {_methodName: "arrayUnion", args};
  }),
  arrayRemove: jest.fn((...args: unknown[]): Record<string, unknown> => {
    return {_methodName: "arrayRemove", args};
  }),
  increment: jest.fn((n: number): Record<string, unknown> => {
    return {_methodName: "increment", n};
  }),
};

export const mockTimestamp = MockTimestamp;
export const mockGeoPoint = MockGeoPoint;

const mockFirestore = Object.assign(
  jest.fn((): typeof mockFirestoreInstance => mockFirestoreInstance),
  {
    FieldValue: mockFieldValue,
    GeoPoint: mockGeoPoint,
    Timestamp: mockTimestamp,
  }
);

export const makeDocSnapshot = (
  data: Record<string, unknown> | null,
  id = "mock-doc-id"
): MockDocumentSnapshot => {
  return {
    id,
    exists: data !== null,
    data: (): Record<string, unknown> | undefined => data ?? undefined,
  };
};

export const makeQuerySnapshot = (
  docs: Array<{
    id: string;
    data: () => Record<string, unknown>;
    ref?: typeof mockDocRef;
  }>
): MockQuerySnapshot => {
  const queryDocs = docs.map((doc): MockQueryDocument => {
    return {
      id: doc.id,
      ref: doc.ref ?? mockDocRef,
      data: doc.data,
    };
  });

  return {
    forEach: (cb: (doc: MockQueryDocument) => void): void => {
      queryDocs.forEach(cb);
    },
    docs: queryDocs,
    empty: queryDocs.length === 0,
    size: queryDocs.length,
  };
};

const applyDefaultMockImplementations = (): void => {
  mockTransaction.get.mockImplementation(async (): Promise<unknown> => {
    return makeDocSnapshot(null);
  });

  mockBatch.set.mockReturnValue(mockBatch);
  mockBatch.update.mockReturnValue(mockBatch);
  mockBatch.delete.mockReturnValue(mockBatch);
  mockBatch.commit.mockResolvedValue(undefined);

  mockDocRef.get.mockResolvedValue(makeDocSnapshot(null));
  mockDocRef.set.mockResolvedValue(undefined);
  mockDocRef.update.mockResolvedValue(undefined);
  mockDocRef.delete.mockResolvedValue(undefined);
  mockDocRef.collection.mockReturnValue(mockQuery);

  mockQuery.doc.mockReturnValue(mockDocRef);
  mockQuery.where.mockReturnValue(mockQuery);
  mockQuery.limit.mockReturnValue(mockQuery);
  mockQuery.orderBy.mockReturnValue(mockQuery);
  mockQuery.get.mockResolvedValue(makeQuerySnapshot([]));
  mockQuery.listDocuments.mockResolvedValue([]);

  mockFirestoreInstance.doc.mockReturnValue(mockDocRef);
  mockFirestoreInstance.collection.mockReturnValue(mockQuery);
  mockFirestoreInstance.runTransaction.mockImplementation(
    async (cb: MockTransactionCallback): Promise<unknown> => {
      return cb(mockTransaction);
    }
  );
  mockFirestoreInstance.writeBatch.mockReturnValue(mockBatch);
  mockFirestoreInstance.batch.mockReturnValue(mockBatch);

  mockStorageInstance.bucket.mockReturnValue(mockBucket);
  mockBucket.file.mockReturnValue(mockFile);
  mockBucket.getFiles.mockResolvedValue([[]]);
  mockBucket.deleteFiles.mockResolvedValue(undefined);
  mockFile.delete.mockResolvedValue(undefined);

  mockDatabaseInstance.ref.mockReturnValue(mockDatabaseRef);
  mockDatabaseRef.remove.mockResolvedValue(undefined);
};

jest.mock("firebase-admin", () => {
  return {
    apps: [],
    firestore: mockFirestore,
    auth: jest.fn((): typeof mockAuthInstance => mockAuthInstance),
    storage: jest.fn((): typeof mockStorageInstance => mockStorageInstance),
    database: jest.fn((): typeof mockDatabaseInstance => mockDatabaseInstance),
    initializeApp: jest.fn(),
    credential: {
      applicationDefault: jest.fn(),
    },
  };
});

jest.mock("firebase-admin/firestore", () => {
  return {
    FieldValue: mockFieldValue,
    GeoPoint: mockGeoPoint,
    Timestamp: mockTimestamp,
    getFirestore: jest.fn((): typeof mockFirestoreInstance => {
      return mockFirestoreInstance;
    }),
  };
});

applyDefaultMockImplementations();

export const resetAllMocks = (): void => {
  mockTransaction.get.mockReset();
  mockTransaction.set.mockReset();
  mockTransaction.update.mockReset();
  mockTransaction.delete.mockReset();
  mockBatch.set.mockReset();
  mockBatch.update.mockReset();
  mockBatch.delete.mockReset();
  mockBatch.commit.mockReset();
  mockDocRef.get.mockReset();
  mockDocRef.set.mockReset();
  mockDocRef.update.mockReset();
  mockDocRef.delete.mockReset();
  mockDocRef.collection.mockReset();
  mockQuery.doc.mockReset();
  mockQuery.where.mockReset();
  mockQuery.limit.mockReset();
  mockQuery.orderBy.mockReset();
  mockQuery.get.mockReset();
  mockQuery.listDocuments.mockReset();
  mockFirestoreInstance.doc.mockReset();
  mockFirestoreInstance.collection.mockReset();
  mockFirestoreInstance.runTransaction.mockReset();
  mockFirestoreInstance.writeBatch.mockReset();
  mockFirestoreInstance.batch.mockReset();
  mockAuthInstance.getUser.mockReset();
  mockAuthInstance.deleteUser.mockReset();
  mockAuthInstance.setCustomUserClaims.mockReset();
  mockStorageInstance.bucket.mockReset();
  mockBucket.file.mockReset();
  mockBucket.getFiles.mockReset();
  mockBucket.deleteFiles.mockReset();
  mockFile.delete.mockReset();
  mockDatabaseInstance.ref.mockReset();
  mockDatabaseRef.remove.mockReset();
  mockFieldValue.serverTimestamp.mockClear();
  mockFieldValue.delete.mockClear();
  mockFieldValue.arrayUnion.mockClear();
  mockFieldValue.arrayRemove.mockClear();
  mockFieldValue.increment.mockClear();
  mockTimestamp.fromMillis.mockClear();
  mockTimestamp.now.mockClear();
  applyDefaultMockImplementations();
};
