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

interface DeleteAccountResult {
  success: true;
}

const REGION = "asia-southeast1";
const STRIPE_API_VERSION = "2023-10-16";
const BATCH_LIMIT = 500;

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const rtdb = admin.database();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getStripeCustomerId = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.stripeCustomerId !== "string") {
    return null;
  }

  return value.stripeCustomerId.length > 0 ? value.stripeCustomerId : null;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Unknown error";
};

const getStripeClient = (): Stripe => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (stripeSecretKey === undefined || stripeSecretKey.length === 0) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
};

const deleteDocumentReferences = async (
  refs: readonly admin.firestore.DocumentReference[]
): Promise<void> => {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = refs.slice(i, i + BATCH_LIMIT);

    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

const deleteSubcollection = async (path: string): Promise<void> => {
  const refs = await db.collection(path).listDocuments();
  await deleteDocumentReferences(refs);
};

export const deleteAccount = onCall(
  {region: REGION, secrets: ["STRIPE_SECRET_KEY"]},
  async (
    request: CallableRequest<unknown>
  ): Promise<DeleteAccountResult> => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to delete account."
      );
    }

    const uid = request.auth.uid;
    const matchIds: string[] = [];

    // <!-- ARCHITECT NOTE: The service deletion order below follows
    //   TASKS_PHASE4.md exactly: Stripe, Firestore, Storage, RTDB, then Auth.
    //   Do not move parent-doc or Auth deletion earlier in this sequence. -->

    // <!-- ARCHITECT NOTE: Stripe cancellation is best-effort and uses
    //   cancel_at_period_end so the user keeps paid access until expiry. A
    //   Stripe outage must not block PDPA account deletion. -->
    try {
      const userSnap = await db.doc(`users/${uid}`).get();
      const stripeCustomerId = getStripeCustomerId(userSnap.data());

      if (stripeCustomerId !== null) {
        const stripe = getStripeClient();
        const activeSubscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "active",
          limit: 1,
        });
        const activeSubscription = activeSubscriptions.data[0];

        if (activeSubscription !== undefined) {
          await stripe.subscriptions.update(activeSubscription.id, {
            cancel_at_period_end: true,
          });
        }
      }
    } catch (error: unknown) {
      console.warn("deleteAccount: Stripe cleanup failed.", {
        uid,
        message: getErrorMessage(error),
      });
    }

    await Promise.allSettled([
      deleteSubcollection(`users/${uid}/dailyLikes`),
      deleteSubcollection(`users/${uid}/notificationPreferences`),
      deleteSubcollection(`users/${uid}/warnings`),
    ]);

    await db.doc(`users/${uid}`).delete();

    await Promise.allSettled([
      deleteSubcollection(`swipes/${uid}/likes`),
      deleteSubcollection(`swipes/${uid}/passes`),
    ]);

    try {
      await db.doc(`swipes/${uid}`).delete();
    } catch (error: unknown) {
      console.warn("deleteAccount: swipe parent cleanup failed.", {
        uid,
        message: getErrorMessage(error),
      });
    }

    const matchesSnap = await db
      .collection("matches")
      .where("users", "array-contains", uid)
      .get();
    const matchRefs = matchesSnap.docs.map((doc) => {
      matchIds.push(doc.id);
      return doc.ref;
    });

    await deleteDocumentReferences(matchRefs);

    try {
      const checkinsSnap = await db
        .collection("gymCheckins")
        .where("userId", "==", uid)
        .get();
      const checkinRefs = checkinsSnap.docs.map((doc) => doc.ref);

      await deleteDocumentReferences(checkinRefs);
    } catch (error: unknown) {
      console.warn("deleteAccount: gymCheckins cleanup failed.", {
        uid,
        message: getErrorMessage(error),
      });
    }

    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({prefix: `users/${uid}/`});

      await Promise.allSettled(files.map((file) => file.delete()));
    } catch (error: unknown) {
      console.warn("deleteAccount: Storage cleanup failed.", {
        uid,
        message: getErrorMessage(error),
      });
    }

    await Promise.allSettled(
      matchIds.map((matchId) => {
        return rtdb
          .ref(`chats/${matchId}`)
          .remove()
          .catch((error: unknown) => {
            console.warn("deleteAccount: RTDB chat deletion failed.", {
              matchId,
              message: getErrorMessage(error),
            });
          });
      })
    );

    // <!-- ARCHITECT NOTE: Auth deletion must stay last. Once the user record
    //   is deleted, the client cannot make another authenticated cleanup call,
    //   so every other service cleanup must happen before this await. -->
    await auth.deleteUser(uid);

    return {success: true};
  }
);
