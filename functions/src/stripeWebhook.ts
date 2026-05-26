import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import Stripe from "stripe";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type PremiumTier = "plus" | "pro";

const STRIPE_API_VERSION = "2023-10-16";

const findUserByCustomerId = async (
  customerId: string
): Promise<string | null> => {
  const snapshot = await admin
    .firestore()
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].id;
};

const getTierFromSubscription = (
  subscription: Stripe.Subscription
): PremiumTier => {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const proIds = new Set<string>([
    process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    process.env.STRIPE_PRICE_PRO_3MONTH ?? "",
    process.env.STRIPE_PRICE_PRO_6MONTH ?? "",
  ]);

  return proIds.has(priceId) ? "pro" : "plus";
};

const getCustomerId = (
  subscription: Stripe.Subscription
): string | null => {
  const customer = subscription.customer;

  if (typeof customer === "string") {
    return customer;
  }

  if (customer !== null && typeof customer.id === "string") {
    return customer.id;
  }

  return null;
};

const isStripeSubscription = (
  value: unknown
): value is Stripe.Subscription => {
  if (!isRecord(value)) {
    return false;
  }

  const customer = value.customer;
  const items = value.items;

  return (
    value.object === "subscription" &&
    typeof value.id === "string" &&
    typeof value.current_period_end === "number" &&
    typeof value.status === "string" &&
    (typeof customer === "string" || isRecord(customer)) &&
    isRecord(items) &&
    Array.isArray(items.data)
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const processSubscriptionUpsert = async (
  subscription: Stripe.Subscription
): Promise<boolean> => {
  const customerId = getCustomerId(subscription);
  if (customerId === null) {
    logger.error("stripeWebhook: subscription customer ID missing.");
    return false;
  }

  const uid = await findUserByCustomerId(customerId);
  if (uid === null) {
    logger.warn("stripeWebhook: no user found for Stripe customer.");
    return true;
  }

  const tier = getTierFromSubscription(subscription);
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    subscription.current_period_end * 1000
  );

  await admin.firestore().doc(`users/${uid}`).update({
    "premium.active": isActive,
    "premium.tier": isActive ? tier : null,
    "premium.subscriptionId": subscription.id,
    "premium.expiresAt": isActive ? expiresAt : null,
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info("stripeWebhook: premium updated.", {
    uid,
    tier,
    active: isActive,
  });

  return true;
};

const processSubscriptionDeleted = async (
  subscription: Stripe.Subscription
): Promise<boolean> => {
  const customerId = getCustomerId(subscription);
  if (customerId === null) {
    logger.error("stripeWebhook: deleted subscription customer ID missing.");
    return false;
  }

  const uid = await findUserByCustomerId(customerId);
  if (uid === null) {
    logger.warn("stripeWebhook: no user found for deleted subscription.");
    return true;
  }

  await admin.firestore().doc(`users/${uid}`).update({
    "premium.active": false,
    "premium.tier": null,
    "premium.subscriptionId": null,
    "premium.expiresAt": null,
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info("stripeWebhook: premium cancelled.", {uid});

  return true;
};

export const stripeWebhook = onRequest(
  {
    region: "asia-southeast1",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  async (req, res): Promise<void> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (
      stripeSecretKey === undefined ||
      stripeSecretKey.length === 0 ||
      webhookSecret === undefined ||
      webhookSecret.length === 0
    ) {
      logger.error("stripeWebhook: Stripe env vars not configured.");
      res.sendStatus(500);
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (signature === undefined) {
      res.status(400).send("Missing stripe-signature header.");
      return;
    }

    if (!Buffer.isBuffer(req.rawBody)) {
      res.status(400).send("Missing raw request body.");
      return;
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("stripeWebhook: signature verification failed.", {message});
      res
        .status(400)
        .send(`Webhook signature verification failed: ${message}`);
      return;
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      if (!isStripeSubscription(event.data.object)) {
        logger.error("stripeWebhook: subscription payload is invalid.", {
          eventType: event.type,
        });
        res.sendStatus(400);
        return;
      }

      const processed = await processSubscriptionUpsert(event.data.object);
      res.sendStatus(processed ? 200 : 400);
      return;
    }

    if (event.type === "customer.subscription.deleted") {
      if (!isStripeSubscription(event.data.object)) {
        logger.error("stripeWebhook: deleted subscription payload is invalid.");
        res.sendStatus(400);
        return;
      }

      const processed = await processSubscriptionDeleted(event.data.object);
      res.sendStatus(processed ? 200 : 400);
      return;
    }

    res.sendStatus(200);
  }
);
