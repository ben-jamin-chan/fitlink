import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

interface SwipeDoc {
  swiperId: string;
  targetId: string;
  isSuperLike: boolean;
  createdAt: Timestamp;
}

interface MatchDoc {
  users: [string, string];
  createdAt: FieldValue;
  lastMessage: null;
  lastMessageAt: null;
  [key: string]: unknown;
}

const buildMatchId = (uidA: string, uidB: string): string =>
  [uidA, uidB].sort().join("_");

const sendMatchNotifications = async (
  userId: string,
  targetId: string,
  isSuperLike: boolean
): Promise<void> => {
  // TODO Task 33: fetch expoPushToken for both users and call Expo Push API.
  logger.info("sendMatchNotifications stub", {userId, targetId, isSuperLike});
};

export const onSwipeCreated = onDocumentCreated(
  {
    document: "swipes/{userId}/likes/{targetId}",
    region: "asia-southeast1",
  },
  async (event): Promise<void> => {
    const userIdParam: unknown = event.params.userId;
    const targetIdParam: unknown = event.params.targetId;

    if (typeof userIdParam !== "string" || typeof targetIdParam !== "string") {
      logger.error("onSwipeCreated: invalid path params", {
        userId: userIdParam,
        targetId: targetIdParam,
      });
      return;
    }

    const userId = userIdParam;
    const targetId = targetIdParam;

    if (event.data === undefined) {
      logger.error("onSwipeCreated: event.data is undefined", {userId, targetId});
      return;
    }

    const swipeData = toSwipeDoc(event.data.data());
    if (swipeData === null) {
      logger.error("onSwipeCreated: swipe doc data is invalid", {
        userId,
        targetId,
      });
      return;
    }

    const {isSuperLike} = swipeData;
    const db = admin.firestore();

    const reverseLikeRef = db.doc(`swipes/${targetId}/likes/${userId}`);
    const reverseLikeSnap = await reverseLikeRef.get();

    if (!reverseLikeSnap.exists) {
      logger.info("onSwipeCreated: no mutual like, no match created", {
        userId,
        targetId,
      });
      return;
    }

    const matchId = buildMatchId(userId, targetId);
    const matchRef = db.doc(`matches/${matchId}`);

    const existingMatch = await matchRef.get();
    if (existingMatch.exists) {
      logger.warn("onSwipeCreated: match doc already exists, skipping", {
        matchId,
      });
      return;
    }

    const sortedUsers = [userId, targetId].sort();
    const sortedUidA = sortedUsers[0];
    const sortedUidB = sortedUsers[1];

    const matchDoc: MatchDoc = {
      users: [sortedUidA, sortedUidB],
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null,
      [`${userId}_unread`]: 0,
      [`${targetId}_unread`]: 0,
    };

    const batch = db.batch();

    batch.set(matchRef, matchDoc);

    const swiperRef = db.doc(`users/${userId}`);
    batch.update(swiperRef, {
      "stats.matches": FieldValue.increment(1),
    });

    const targetRef = db.doc(`users/${targetId}`);
    batch.update(targetRef, {
      "stats.matches": FieldValue.increment(1),
    });

    await batch.commit();

    logger.info("onSwipeCreated: match created", {
      matchId,
      userId,
      targetId,
      isSuperLike,
    });

    await sendMatchNotifications(userId, targetId, isSuperLike);
  }
);

function toSwipeDoc(
  data: admin.firestore.DocumentData | undefined
): SwipeDoc | null {
  if (data === undefined) {
    return null;
  }

  const rawData: Record<string, unknown> = data;

  if (
    typeof rawData.swiperId !== "string" ||
    typeof rawData.targetId !== "string" ||
    typeof rawData.isSuperLike !== "boolean" ||
    !(rawData.createdAt instanceof Timestamp)
  ) {
    return null;
  }

  return {
    swiperId: rawData.swiperId,
    targetId: rawData.targetId,
    isSuperLike: rawData.isSuperLike,
    createdAt: rawData.createdAt,
  };
}
