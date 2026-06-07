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

interface CreateCustomerPortalSessionResponse {
  url: string;
}

const PORTAL_RETURN_URL = "fitlink://premium";
const STRIPE_API_VERSION = "2023-10-16";

const getStripeCustomerId = (
  data: Record<string, unknown>
): string | null => {
  return typeof data.stripeCustomerId === "string" ?
    data.stripeCustomerId :
    null;
};

export const createCustomerPortalSession = onCall(
  {region: "asia-southeast1", secrets: ["STRIPE_SECRET_KEY"]},
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<CreateCustomerPortalSessionResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be signed in to manage subscription."
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey === undefined || stripeSecretKey.length === 0) {
      throw new HttpsError("internal", "Stripe is not configured.");
    }

    const uid = request.auth.uid;
    const userSnap = await admin.firestore().doc(`users/${uid}`).get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData: Record<string, unknown> = userSnap.data() ?? {};
    const stripeCustomerId = getStripeCustomerId(userData);

    if (stripeCustomerId === null) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe customer record found."
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: PORTAL_RETURN_URL,
      });

      return {url: session.url};
    } catch {
      throw new HttpsError(
        "internal",
        "Unable to create Stripe portal session."
      );
    }
  }
);
