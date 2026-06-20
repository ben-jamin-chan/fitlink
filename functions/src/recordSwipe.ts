import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

import {
  isExpoPushToken,
  sendExpoPushNotification,
} from "./utils/expoPush";
import {isNotificationPreferenceEnabled} from "./utils/notificationPreferences";

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
const LIKED_ME_PUSH_TITLE = "Someone liked you";
const LIKED_ME_PUSH_BODY = "Open the app to see who it is.";

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
    if (direction === "superlike" && !isPremium) {
      throw new HttpsError("permission-denied", "premium_required");
    }

    const dailyLikesRef = db.doc(`users/${userId}/dailyLikes/doc`);
    const swipeRef = db.doc(`swipes/${userId}/likes/${targetId}`);
    let remainingLikes = getRemainingLikes(isPremium, 0);

    await db.runTransaction(async (transaction): Promise<void> => {
      const dailyLikesSnap = await transaction.get(dailyLikesRef);
      const dailyLikesData = getDailyLikesData(dailyLikesSnap.data());

      const now = Timestamp.now();
      const nowMs = now.toMillis();

      let count = 0;
      let resetAt = Timestamp.fromMillis(await getNextMidnightMs(userId));

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

    await sendLikedMePushNotification(db, targetId, direction);

    return {success: true, remainingLikes};
  }
);

async function sendLikedMePushNotification(
  db: admin.firestore.Firestore,
  targetId: string,
  direction: SwipeDirection
): Promise<void> {
  const shouldSendLikedMePush =
    direction === "like" || direction === "superlike";

  if (!shouldSendLikedMePush) {
    return;
  }

  const targetSnap = await db.doc(`users/${targetId}`).get();
  const targetData: unknown = targetSnap.data();

  if (!isPremiumActive(targetData) || !isRecord(targetData)) {
    return;
  }

  const expoPushToken =
    typeof targetData.expoPushToken === "string" ?
      targetData.expoPushToken.trim() :
      undefined;

  if (
    expoPushToken === undefined ||
    expoPushToken.length === 0 ||
    !isExpoPushToken(expoPushToken)
  ) {
    return;
  }

  const prefsSnap = await db
    .doc(`users/${targetId}/notificationPreferences/prefs`)
    .get();
  const prefsData: unknown = prefsSnap.data();

  if (!isNotificationPreferenceEnabled(prefsData, "likedMe")) {
    return;
  }

  await sendExpoPushNotification({
    to: expoPushToken,
    title: LIKED_ME_PUSH_TITLE,
    body: LIKED_ME_PUSH_BODY,
    sound: "default",
    data: {
      type: "likedMe",
    },
  }, "recordSwipe");
}

async function getNextMidnightMs(uid: string): Promise<number> {
  const userDoc = await admin.firestore().doc(`users/${uid}`).get();
  const userData: unknown = userDoc.data();
  const timezone =
    isRecord(userData) &&
    typeof userData.timezone === "string" &&
    userData.timezone.length > 0 ?
      userData.timezone :
      "Asia/Kuala_Lumpur";

  const now = new Date();
  const partsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const getPart = (
    parts: Intl.DateTimeFormatPart[],
    type: string
  ): number => {
    return Number(parts.find((part) => part.type === type)?.value ?? 0);
  };
  const getOffsetMs = (date: Date): number => {
    const parts = partsFormatter.formatToParts(date);
    const localYear = getPart(parts, "year");
    const localMonth = getPart(parts, "month");
    const localDay = getPart(parts, "day");
    const localHour = getPart(parts, "hour");
    const localMinute = getPart(parts, "minute");
    const localSecond = getPart(parts, "second");
    const localAsUtcMs = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMinute,
      localSecond
    );
    const dateMsWithoutMilliseconds = date.getTime() - date.getMilliseconds();

    return localAsUtcMs - dateMsWithoutMilliseconds;
  };

  const nowParts = partsFormatter.formatToParts(now);
  const year = getPart(nowParts, "year");
  const month = getPart(nowParts, "month");
  const day = getPart(nowParts, "day");
  const nextLocalMidnightAsUtcMs = Date.UTC(year, month - 1, day + 1);
  let nextMidnightUtcMs = nextLocalMidnightAsUtcMs - getOffsetMs(now);

  nextMidnightUtcMs =
    nextLocalMidnightAsUtcMs - getOffsetMs(new Date(nextMidnightUtcMs));
  nextMidnightUtcMs =
    nextLocalMidnightAsUtcMs - getOffsetMs(new Date(nextMidnightUtcMs));

  return nextMidnightUtcMs > now.getTime() ?
    nextMidnightUtcMs :
    nextMidnightUtcMs + 86400 * 1000;
}
