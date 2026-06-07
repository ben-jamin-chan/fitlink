import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface ActivateBoostResponse {
  expiresAt: number;
  success: true;
}

interface BoostState {
  activatedAt?: admin.firestore.Timestamp;
}

const BOOST_DURATION_MS = 30 * 60 * 1000;
const REGION = "asia-southeast1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isProSubscriber = (data: Record<string, unknown>): boolean => {
  if (!isRecord(data.premium)) {
    return false;
  }

  return data.premium.active === true && data.premium.tier === "pro";
};

const getBoostState = (value: unknown): BoostState | null => {
  if (!isRecord(value)) {
    return null;
  }

  const activatedAt = value.activatedAt;

  if (!(activatedAt instanceof admin.firestore.Timestamp)) {
    return {};
  }

  return {activatedAt};
};

const isCurrentCalendarMonth = (
  timestamp: admin.firestore.Timestamp
): boolean => {
  const activatedAt = timestamp.toDate();
  const now = new Date();

  return (
    activatedAt.getFullYear() === now.getFullYear() &&
    activatedAt.getMonth() === now.getMonth()
  );
};

export const activateBoost = onCall(
  {region: REGION},
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<ActivateBoostResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to activate boost."
      );
    }

    const uid = request.auth.uid;
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }

    const userData: Record<string, unknown> = userSnap.data() ?? {};

    if (!isProSubscriber(userData)) {
      throw new HttpsError(
        "permission-denied",
        "profile_boost_pro_required"
      );
    }

    const boost = getBoostState(userData.boost);

    if (
      boost?.activatedAt !== undefined &&
      isCurrentCalendarMonth(boost.activatedAt)
    ) {
      throw new HttpsError(
        "resource-exhausted",
        "profile_boost_already_used_this_month"
      );
    }

    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + BOOST_DURATION_MS
    );

    await userRef.update({
      boost: {
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      },
    });

    return {
      expiresAt: expiresAt.toMillis(),
      success: true,
    };
  }
);
