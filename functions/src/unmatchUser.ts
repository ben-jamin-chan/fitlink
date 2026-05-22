import { getDatabase } from "firebase-admin/database";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

interface UnmatchUserRequest {
  matchId: string;
}

interface UnmatchUserResponse {
  success: boolean;
}

const toMatchUsers = (data: FirebaseFirestore.DocumentData | undefined):
  string[] | null => {
  if (data === undefined || !Array.isArray(data.users)) {
    return null;
  }

  const users = data.users;

  if (!users.every((userId: unknown): userId is string =>
    typeof userId === "string")) {
    return null;
  }

  return users;
};

/**
 * Performs a safe, bilateral unmatch owned by the backend.
 */
export const unmatchUser = onCall(
  { region: "asia-southeast1" },
  async (
    request: CallableRequest<UnmatchUserRequest>
  ): Promise<UnmatchUserResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const callerId = request.auth.uid;
    const { matchId } = request.data;

    if (typeof matchId !== "string" || matchId.length === 0) {
      throw new HttpsError("invalid-argument", "matchId is required");
    }

    const db = getFirestore();
    const rtdb = getDatabase();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      throw new HttpsError("not-found", "Match not found");
    }

    const users = toMatchUsers(matchSnap.data());

    if (users === null) {
      throw new HttpsError("failed-precondition", "Match data is invalid");
    }

    if (!users.includes(callerId)) {
      throw new HttpsError(
        "permission-denied",
        "You are not a participant in this match"
      );
    }

    const otherUserId = users.find((uid: string): boolean => uid !== callerId);

    if (otherUserId === undefined) {
      throw new HttpsError(
        "internal",
        "Could not determine other participant"
      );
    }

    await Promise.all([
      matchRef.delete(),
      rtdb.ref(`chats/${matchId}`).remove().catch((error: unknown): void => {
        logger.error("unmatchUser: RTDB cleanup failed", { matchId, error });
      }),
      db.doc(`blocked/${callerId}/users/${otherUserId}`).set({
        blockedAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`blocked/${otherUserId}/users/${callerId}`).set({
        blockedAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`users/${callerId}`).update({
        "stats.matches": FieldValue.increment(-1),
      }),
      db.doc(`users/${otherUserId}`).update({
        "stats.matches": FieldValue.increment(-1),
      }),
    ]);

    return { success: true };
  }
);
