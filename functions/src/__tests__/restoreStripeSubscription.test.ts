import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type {DecodedIdToken} from "firebase-admin/auth";

import {
  makeDocSnapshot,
  mockFirestoreInstance,
  mockTimestamp,
  resetAllMocks,
} from "./helpers/firebaseAdminMock";
import {
  mockStripeSubscriptions,
  resetStripeMocks,
} from "./helpers/stripeMock";

type RestoreStripeSubscriptionFunction =
  typeof import("../restoreStripeSubscription").restoreStripeSubscription;
type RestoreStripeSubscriptionRunRequest = Parameters<
  RestoreStripeSubscriptionFunction["run"]
>[0];
type RestoreStripeSubscriptionRunResult = Awaited<
  ReturnType<RestoreStripeSubscriptionFunction["run"]>
>;

interface TestDocumentRef {
  id: string;
  path: string;
  get: jest.Mock<() => Promise<unknown>>;
  update: jest.Mock<(...args: unknown[]) => Promise<void>>;
}

const uid = "user1";
const stripeCustomerId = "cus_restore_user1";
const activeSubscriptionId = "sub_restore_user1";
const proPriceId = "price_test_restore_pro_monthly";
const currentPeriodEndSeconds = 1782686400;
const expectedExpiresAtMs = currentPeriodEndSeconds * 1000;

let restoreStripeSubscription: RestoreStripeSubscriptionFunction;
let originalStripeSecretKey: string | undefined;
let originalProPriceId: string | undefined;

const documentData = new Map<string, Record<string, unknown> | null>();
const documentRefs = new Map<string, TestDocumentRef>();

const getDocumentId = (path: string): string => {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? "mock-doc-id";
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
    update: jest.fn(async (): Promise<void> => undefined),
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

const installPathAwareFirestore = (): void => {
  mockFirestoreInstance.doc.mockImplementation((path: unknown): unknown => {
    return getDocumentRef(typeof path === "string" ? path : "unknown");
  });
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

const makeRequest = (
  userId: string | null
): RestoreStripeSubscriptionRunRequest => {
  const request = {
    auth: userId === null ? null : {uid: userId, token: makeDecodedToken(userId)},
    data: {},
    rawRequest: {},
  };

  // CallableRequest includes framework-owned fields not relevant to direct .run tests.
  return request as unknown as RestoreStripeSubscriptionRunRequest;
};

const callRestoreStripeSubscription = (
  request: RestoreStripeSubscriptionRunRequest
): Promise<RestoreStripeSubscriptionRunResult> => {
  return restoreStripeSubscription.run(request);
};

const setUserData = (
  data: Record<string, unknown> | null
): void => {
  documentData.set(`users/${uid}`, data);
};

beforeAll(async () => {
  originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
  originalProPriceId = process.env.STRIPE_PRICE_MYR_PRO_MONTHLY;
  process.env.STRIPE_SECRET_KEY = "sk_test_restore_subscription";
  process.env.STRIPE_PRICE_MYR_PRO_MONTHLY = proPriceId;

  const module = await import("../restoreStripeSubscription");
  restoreStripeSubscription = module.restoreStripeSubscription;
});

beforeEach(() => {
  resetAllMocks();
  resetStripeMocks();
  documentData.clear();
  documentRefs.clear();
  installPathAwareFirestore();
  setUserData({
    stripeCustomerId,
  });
  mockStripeSubscriptions.list.mockImplementation(
    async (): Promise<unknown> => ({data: []})
  );
});

afterAll(() => {
  if (originalStripeSecretKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
  }

  if (originalProPriceId === undefined) {
    delete process.env.STRIPE_PRICE_MYR_PRO_MONTHLY;
  } else {
    process.env.STRIPE_PRICE_MYR_PRO_MONTHLY = originalProPriceId;
  }
});

describe("restoreStripeSubscription", () => {
  it("throws unauthenticated when request.auth is null", async () => {
    await expect(
      callRestoreStripeSubscription(makeRequest(null))
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("returns no-customer without querying Stripe when stripeCustomerId is absent", async () => {
    setUserData({});

    const result = await callRestoreStripeSubscription(makeRequest(uid));

    expect(mockStripeSubscriptions.list).not.toHaveBeenCalled();
    expect(result).toEqual({
      restored: false,
      reason: "no-customer",
    });
  });

  it("returns no-active-subscription when Stripe finds no active subscriptions", async () => {
    const result = await callRestoreStripeSubscription(makeRequest(uid));

    expect(mockStripeSubscriptions.list).toHaveBeenCalledWith({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
      expand: ["data.items.data.price"],
    });
    expect(getDocumentRef(`users/${uid}`).update).not.toHaveBeenCalled();
    expect(result).toEqual({
      restored: false,
      reason: "no-active-subscription",
    });
  });

  it("writes premium fields and returns restored result for an active subscription", async () => {
    mockStripeSubscriptions.list.mockImplementation(
      async (): Promise<unknown> => ({
        data: [
          {
            current_period_end: currentPeriodEndSeconds,
            id: activeSubscriptionId,
            items: {
              data: [
                {
                  price: {
                    id: proPriceId,
                  },
                },
              ],
            },
            status: "active",
          },
        ],
      })
    );

    const result = await callRestoreStripeSubscription(makeRequest(uid));
    const expectedExpiresAt = expect.objectContaining({
      nanoseconds: 0,
      seconds: currentPeriodEndSeconds,
    });

    expect(getDocumentRef(`users/${uid}`).update).toHaveBeenCalledWith({
      "premium.active": true,
      "premium.tier": "pro",
      "premium.subscriptionId": activeSubscriptionId,
      "premium.expiresAt": expectedExpiresAt,
    });
    expect(mockTimestamp.fromMillis).toHaveBeenCalledWith(expectedExpiresAtMs);
    expect(result).toEqual({
      restored: true,
      tier: "pro",
      expiresAt: expectedExpiresAt,
    });
  });
});
