import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import {Timestamp} from "firebase-admin/firestore";
import Stripe from "stripe";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type SubscriptionTier = "plus" | "pro";

type RestoreResult =
  | { restored: false; reason: "no-customer" }
  | { restored: false; reason: "no-active-subscription" }
  | { restored: true; tier: SubscriptionTier; expiresAt: Timestamp };

const STRIPE_API_VERSION = "2023-10-16";

const PLUS_PRICE_ENV_KEYS: readonly string[] = [
  "STRIPE_PRICE_PLUS_MONTHLY",
  "STRIPE_PRICE_PLUS_3MONTH",
  "STRIPE_PRICE_PLUS_6MONTH",
  "STRIPE_PRICE_MYR_PLUS_MONTHLY",
  "STRIPE_PRICE_MYR_PLUS_3MONTH",
  "STRIPE_PRICE_MYR_PLUS_6MONTH",
  "STRIPE_PRICE_SGD_PLUS_MONTHLY",
  "STRIPE_PRICE_SGD_PLUS_3MONTH",
  "STRIPE_PRICE_SGD_PLUS_6MONTH",
  "STRIPE_PRICE_THB_PLUS_MONTHLY",
  "STRIPE_PRICE_THB_PLUS_3MONTH",
  "STRIPE_PRICE_THB_PLUS_6MONTH",
  "STRIPE_PRICE_PHP_PLUS_MONTHLY",
  "STRIPE_PRICE_PHP_PLUS_3MONTH",
  "STRIPE_PRICE_PHP_PLUS_6MONTH",
  "STRIPE_PRICE_IDR_PLUS_MONTHLY",
  "STRIPE_PRICE_IDR_PLUS_3MONTH",
  "STRIPE_PRICE_IDR_PLUS_6MONTH",
  "STRIPE_PRICE_VND_PLUS_MONTHLY",
  "STRIPE_PRICE_VND_PLUS_3MONTH",
  "STRIPE_PRICE_VND_PLUS_6MONTH",
];

const PRO_PRICE_ENV_KEYS: readonly string[] = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_3MONTH",
  "STRIPE_PRICE_PRO_6MONTH",
  "STRIPE_PRICE_MYR_PRO_MONTHLY",
  "STRIPE_PRICE_MYR_PRO_3MONTH",
  "STRIPE_PRICE_MYR_PRO_6MONTH",
  "STRIPE_PRICE_SGD_PRO_MONTHLY",
  "STRIPE_PRICE_SGD_PRO_3MONTH",
  "STRIPE_PRICE_SGD_PRO_6MONTH",
  "STRIPE_PRICE_THB_PRO_MONTHLY",
  "STRIPE_PRICE_THB_PRO_3MONTH",
  "STRIPE_PRICE_THB_PRO_6MONTH",
  "STRIPE_PRICE_PHP_PRO_MONTHLY",
  "STRIPE_PRICE_PHP_PRO_3MONTH",
  "STRIPE_PRICE_PHP_PRO_6MONTH",
  "STRIPE_PRICE_IDR_PRO_MONTHLY",
  "STRIPE_PRICE_IDR_PRO_3MONTH",
  "STRIPE_PRICE_IDR_PRO_6MONTH",
  "STRIPE_PRICE_VND_PRO_MONTHLY",
  "STRIPE_PRICE_VND_PRO_3MONTH",
  "STRIPE_PRICE_VND_PRO_6MONTH",
];

const buildPriceTierMap = (): Record<string, SubscriptionTier> => {
  const map: Record<string, SubscriptionTier> = {};

  for (const key of PLUS_PRICE_ENV_KEYS) {
    const priceId = process.env[key];
    if (priceId !== undefined && priceId.length > 0) {
      map[priceId] = "plus";
    }
  }

  for (const key of PRO_PRICE_ENV_KEYS) {
    const priceId = process.env[key];
    if (priceId !== undefined && priceId.length > 0) {
      map[priceId] = "pro";
    }
  }

  return map;
};

const PRICE_TIER_MAP = buildPriceTierMap();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getStripeCustomerId = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.stripeCustomerId !== "string") {
    return null;
  }

  return value.stripeCustomerId.length > 0 ? value.stripeCustomerId : null;
};

const resolveTier = (priceId: string | undefined): SubscriptionTier => {
  if (priceId !== undefined && PRICE_TIER_MAP[priceId] !== undefined) {
    return PRICE_TIER_MAP[priceId];
  }

  logger.warn(
    "restoreStripeSubscription: unrecognised subscription price; " +
      "defaulting to plus tier."
  );
  return "plus";
};

export const restoreStripeSubscription = onCall(
  {region: "asia-southeast1", secrets: ["STRIPE_SECRET_KEY"]},
  async (request: CallableRequest<unknown>): Promise<RestoreResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = request.auth.uid;
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }

    const stripeCustomerId = getStripeCustomerId(userSnap.data());
    if (stripeCustomerId === null) {
      return {restored: false, reason: "no-customer"};
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey === undefined || stripeSecretKey.length === 0) {
      throw new HttpsError("internal", "Stripe is not configured.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
      expand: ["data.items.data.price"],
    });

    if (subscriptions.data.length === 0) {
      return {restored: false, reason: "no-active-subscription"};
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const tier = resolveTier(priceId);
    const expiresAt = Timestamp.fromMillis(
      subscription.current_period_end * 1000
    );

    await userRef.update({
      "premium.active": true,
      "premium.tier": tier,
      "premium.subscriptionId": subscription.id,
      "premium.expiresAt": expiresAt,
    });

    return {restored: true, tier, expiresAt};
  }
);
