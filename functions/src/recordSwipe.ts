import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type SwipeDirection = "like" | "pass" | "superlike";

interface RecordSwipeData {
  targetId: string;
  direction: SwipeDirection;
}

interface RecordSwipeResult {
  success: boolean;
  remainingLikes: number;
}

interface DailyLikesData {
  count: number;
  resetAt: Timestamp;
}

const FREE_DAILY_LIMIT = 50;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isSwipeDirection = (value: unknown): value is SwipeDirection => {
  return value === "like" || value === "pass" || value === "superlike";
};

const getRecordSwipeData = (data: unknown): RecordSwipeData => {
  if (!isRecord(data) || typeof data.targetId !== "string") {
    throw new HttpsError("invalid-argument", "targetId is required");
  }

  if (data.targetId.length === 0) {
    throw new HttpsError("invalid-argument", "targetId is required");
  }

  if (!isSwipeDirection(data.direction)) {
    throw new HttpsError(
      "invalid-argument",
      "direction must be like, pass, or superlike"
    );
  }

  return {
    targetId: data.targetId,
    direction: data.direction,
  };
};

const isPremiumActive = (data: unknown): boolean => {
  if (!isRecord(data) || !isRecord(data.premium)) {
    return false;
  }

  return data.premium.active === true;
};

const getDailyLikesData = (data: unknown): DailyLikesData | null => {
  if (!isRecord(data)) {
    return null;
  }

  if (typeof data.count !== "number" || !(data.resetAt instanceof Timestamp)) {
    return null;
  }

  return {
    count: data.count,
    resetAt: data.resetAt,
  };
};

const getRemainingLikes = (isPremium: boolean, count: number): number => {
  if (isPremium) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, FREE_DAILY_LIMIT - count);
};

const getLikeSwipePayload = (
  userId: string,
  targetId: string,
  direction: SwipeDirection
): Record<string, unknown> => {
  return {
    swiperId: userId,
    targetId,
    isSuperLike: direction === "superlike",
    createdAt: FieldValue.serverTimestamp(),
  };
};

const getPassSwipePayload = (
  userId: string,
  targetId: string
): Record<string, unknown> => {
  return {
    swiperId: userId,
    targetId,
    createdAt: FieldValue.serverTimestamp(),
  };
};

export const recordSwipe = onCall(
  {region: "asia-southeast1"},
  async (
    request: CallableRequest<RecordSwipeData>
  ): Promise<RecordSwipeResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const userId = request.auth.uid;
    const {targetId, direction} = getRecordSwipeData(request.data);
    const db = admin.firestore();

    if (direction === "pass") {
      await db
        .doc(`swipes/${userId}/passes/${targetId}`)
        .set(getPassSwipePayload(userId, targetId));

      return {success: true, remainingLikes: FREE_DAILY_LIMIT};
    }

    const userDoc = await db.doc(`users/${userId}`).get();
    const userData = userDoc.data();

    if (userData === undefined) {
      throw new HttpsError("not-found", "User not found");
    }

    const isPremium = isPremiumActive(userData);
    const dailyLikesRef = db.doc(`users/${userId}/dailyLikes/doc`);
    const swipeRef = db.doc(`swipes/${userId}/likes/${targetId}`);
    let remainingLikes = getRemainingLikes(isPremium, 0);

    await db.runTransaction(async (transaction): Promise<void> => {
      const dailyLikesSnap = await transaction.get(dailyLikesRef);
      const dailyLikesData = getDailyLikesData(dailyLikesSnap.data());

      const now = Timestamp.now();
      const nowMs = now.toMillis();

      let count = 0;
      let resetAt = Timestamp.fromMillis(getNextMidnightMs());

      if (dailyLikesData !== null && dailyLikesData.resetAt.toMillis() > nowMs) {
        count = dailyLikesData.count;
        resetAt = dailyLikesData.resetAt;
      }

      if (!isPremium && count >= FREE_DAILY_LIMIT) {
        throw new HttpsError("resource-exhausted", "daily_limit");
      }

      const nextCount = count + 1;

      transaction.set(
        dailyLikesRef,
        {
          count: nextCount,
          resetAt,
        },
        {merge: true}
      );
      transaction.set(
        swipeRef,
        getLikeSwipePayload(userId, targetId, direction)
      );

      remainingLikes = getRemainingLikes(isPremium, nextCount);
    });

    return {success: true, remainingLikes};
  }
);

/**
 * Returns the Unix timestamp (ms) of the next midnight in UTC+8
 * (Malaysia/SEA time).
 */
function getNextMidnightMs(): number {
  const mytOffsetMs = 8 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowMyt = nowUtc + mytOffsetMs;

  const startOfTodayMyt = Math.floor(nowMyt / 86400000) * 86400000;
  const nextMidnightMyt = startOfTodayMyt + 86400000;

  return nextMidnightMyt - mytOffsetMs;
}
