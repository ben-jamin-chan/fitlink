import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type SwipeCollection = "likes" | "passes";

interface RewindResult {
  targetProfile: Record<string, unknown>;
  targetId: string;
  deletedCollection: SwipeCollection;
}

interface SwipeCandidate {
  targetId: string;
  createdAt: Timestamp;
  collection: SwipeCollection;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isPremiumActive = (data: unknown): boolean => {
  if (!isRecord(data) || !isRecord(data.premium)) {
    return false;
  }

  return data.premium.active === true;
};

const toSwipeCandidate = (
  doc: admin.firestore.QueryDocumentSnapshot | null,
  collection: SwipeCollection
): SwipeCandidate | null => {
  if (doc === null) {
    return null;
  }

  const data: Record<string, unknown> = doc.data();
  const createdAt = data.createdAt;

  if (!(createdAt instanceof Timestamp)) {
    return null;
  }

  return {
    targetId: doc.id,
    createdAt,
    collection,
  };
};

const getMostRecentSwipe = async (
  uid: string,
  db: admin.firestore.Firestore
): Promise<SwipeCandidate | null> => {
  const [likesSnap, passesSnap] = await Promise.all([
    db
      .collection("swipes")
      .doc(uid)
      .collection("likes")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
    db
      .collection("swipes")
      .doc(uid)
      .collection("passes")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
  ]);

  const likeDoc = likesSnap.empty ? null : likesSnap.docs[0];
  const passDoc = passesSnap.empty ? null : passesSnap.docs[0];
  const likeCandidate = toSwipeCandidate(likeDoc, "likes");
  const passCandidate = toSwipeCandidate(passDoc, "passes");

  if (likeCandidate === null && passCandidate === null) {
    return null;
  }

  if (likeCandidate !== null && passCandidate === null) {
    return likeCandidate;
  }

  if (likeCandidate === null && passCandidate !== null) {
    return passCandidate;
  }

  if (likeCandidate !== null && passCandidate !== null) {
    return likeCandidate.createdAt.toMillis() >=
      passCandidate.createdAt.toMillis() ?
      likeCandidate :
      passCandidate;
  }

  return null;
};

export const rewindSwipe = onCall(
  {region: "asia-southeast1"},
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<RewindResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to rewind."
      );
    }

    const uid = request.auth.uid;
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }

    if (!isPremiumActive(userDoc.data())) {
      throw new HttpsError("permission-denied", "Rewind is premium-only.");
    }

    const mostRecent = await getMostRecentSwipe(uid, db);

    if (mostRecent === null) {
      throw new HttpsError(
        "not-found",
        "No swipes to undo.",
        {reason: "no-swipes"}
      );
    }

    const {targetId, collection} = mostRecent;

    await db
      .collection("swipes")
      .doc(uid)
      .collection(collection)
      .doc(targetId)
      .delete();

    const targetDoc = await db.collection("users").doc(targetId).get();

    if (!targetDoc.exists) {
      throw new HttpsError(
        "not-found",
        "The user you swiped on no longer exists."
      );
    }

    const targetProfile: Record<string, unknown> = targetDoc.data() ?? {};

    return {
      targetProfile,
      targetId,
      deletedCollection: collection,
    };
  }
);
