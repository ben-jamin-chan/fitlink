import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface CreateCheckinInput {
  placeId: string;
  gymName: string;
  latitude: number;
  longitude: number;
  city: string;
}

interface CreateCheckinResult {
  checkinId: string;
  expiresAt: admin.firestore.Timestamp;
}

const CHECKIN_DURATION_MS = 2 * 60 * 60 * 1000;
const REGION = "asia-southeast1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isValidCoordinate = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const isValidCreateCheckinInput = (
  value: unknown
): value is CreateCheckinInput => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.placeId === "string" &&
    value.placeId.trim().length > 0 &&
    typeof value.gymName === "string" &&
    value.gymName.trim().length > 0 &&
    isValidCoordinate(value.latitude) &&
    isValidCoordinate(value.longitude) &&
    typeof value.city === "string" &&
    value.city.trim().length > 0
  );
};

export const createCheckin = onCall(
  {region: REGION},
  async (
    request: CallableRequest<CreateCheckinInput>
  ): Promise<CreateCheckinResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to check in."
      );
    }

    if (!isValidCreateCheckinInput(request.data)) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required check-in fields."
      );
    }

    const uid = request.auth.uid;
    const {placeId, gymName, latitude, longitude, city} = request.data;
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const existingSnap = await db
      .collection("gymCheckins")
      .where("userId", "==", uid)
      .where("expiresAt", ">", now)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError("already-exists", "already-checked-in");
    }

    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + CHECKIN_DURATION_MS
    );
    const checkinRef = db.collection("gymCheckins").doc();
    const userRef = db.collection("users").doc(uid);
    const batch = db.batch();

    batch.set(checkinRef, {
      userId: uid,
      placeId,
      gymName,
      coordinates: new admin.firestore.GeoPoint(latitude, longitude),
      city,
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });

    batch.update(userRef, {
      gymCheckin: {gymName, expiresAt},
    });

    await batch.commit();

    return {checkinId: checkinRef.id, expiresAt};
  }
);
