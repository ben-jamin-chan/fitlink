import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import Stripe from "stripe";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface CreateStripeCheckoutData {
  priceId: string;
}

interface CreateStripeCheckoutResponse {
  subscriptionId: string;
  clientSecret: string;
  customerId: string;
}

type PremiumTier = "plus" | "pro";

const STRIPE_API_VERSION = "2023-10-16";

/**
 * Returns valid Stripe price IDs from Cloud Function environment variables.
 * Called per request so emulator and deployed env updates are picked up.
 */
const getAllowedPriceIds = (): Set<string> => {
  const ids = [
    process.env.STRIPE_PRICE_PLUS_MONTHLY,
    process.env.STRIPE_PRICE_PLUS_3MONTH,
    process.env.STRIPE_PRICE_PLUS_6MONTH,
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_3MONTH,
    process.env.STRIPE_PRICE_PRO_6MONTH,
  ].filter((id: string | undefined): id is string => {
    return typeof id === "string" && id.length > 0;
  });

  return new Set(ids);
};

const getTierFromPriceId = (priceId: string): PremiumTier => {
  const proIds = new Set<string>([
    process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    process.env.STRIPE_PRICE_PRO_3MONTH ?? "",
    process.env.STRIPE_PRICE_PRO_6MONTH ?? "",
  ]);

  return proIds.has(priceId) ? "pro" : "plus";
};

const getPriceId = (data: unknown): string | null => {
  if (!isRecord(data)) {
    return null;
  }

  return typeof data.priceId === "string" ? data.priceId : null;
};

const getStripeCustomerId = (
  data: Record<string, unknown>
): string | null => {
  return typeof data.stripeCustomerId === "string" ?
    data.stripeCustomerId :
    null;
};

const getPaymentIntent = (
  subscription: Stripe.Subscription
): Stripe.PaymentIntent | null => {
  const latestInvoice = subscription.latest_invoice;

  if (
    latestInvoice === null ||
    latestInvoice === undefined ||
    typeof latestInvoice === "string"
  ) {
    return null;
  }

  const paymentIntent = latestInvoice.payment_intent;

  if (
    paymentIntent === null ||
    paymentIntent === undefined ||
    typeof paymentIntent === "string"
  ) {
    return null;
  }

  return paymentIntent;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const createStripeCheckout = onCall(
  {region: "asia-southeast1", secrets: ["STRIPE_SECRET_KEY"]},
  async (
    request: CallableRequest<CreateStripeCheckoutData>
  ): Promise<CreateStripeCheckoutResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be signed in to subscribe."
      );
    }

    const priceId = getPriceId(request.data);
    if (priceId === null || !getAllowedPriceIds().has(priceId)) {
      throw new HttpsError("invalid-argument", "Invalid price ID.");
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey === undefined || stripeSecretKey.length === 0) {
      throw new HttpsError("internal", "Stripe is not configured.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    const uid = request.auth.uid;
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData: Record<string, unknown> = userSnap.data() ?? {};
    let customerId = getStripeCustomerId(userData);

    if (customerId === null) {
      const customer = await stripe.customers.create({
        metadata: {firebaseUID: uid},
        ...(typeof userData.email === "string" ? {email: userData.email} : {}),
      });

      customerId = customer.id;

      await userRef.update({
        stripeCustomerId: customerId,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{price: priceId}],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        firebaseUID: uid,
        tier: getTierFromPriceId(priceId),
      },
    });

    const paymentIntent = getPaymentIntent(subscription);

    if (
      paymentIntent === null ||
      paymentIntent.client_secret === null ||
      paymentIntent.client_secret === undefined
    ) {
      throw new HttpsError("internal", "Failed to create payment intent.");
    }

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    };
  }
);
