import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onValueCreated } from "firebase-functions/v2/database";

import {
  isExpoPushToken,
  sendExpoPushNotification,
} from "./utils/expoPush";
import {isNotificationPreferenceEnabled} from "./utils/notificationPreferences";

interface RtdbMessage {
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  timestamp: number;
  read: boolean;
}

const MAX_BODY_LENGTH = 100;
const RTDB_INSTANCE = process.env.RTDB_INSTANCE ?? "";

const buildNotificationBody = (message: RtdbMessage): string => {
  if (message.imageUrl !== null && message.imageUrl.trim().length > 0) {
    return "📷 Sent a photo";
  }

  if (message.text === null || message.text.trim().length === 0) {
    return "Sent a message";
  }

  const text = message.text.trim();
  return text.length > MAX_BODY_LENGTH
    ? `${text.slice(0, MAX_BODY_LENGTH)}…`
    : text;
};

export const onNewMessage = onValueCreated(
  {
    ref: "/chats/{matchId}/messages/{messageId}",
    region: "asia-southeast1",
    instance: RTDB_INSTANCE,
  },
  async (event): Promise<void> => {
    const matchIdParam: unknown = event.params.matchId;
    const messageIdParam: unknown = event.params.messageId;

    if (typeof matchIdParam !== "string" ||
      typeof messageIdParam !== "string") {
      logger.error("onNewMessage: invalid path params", {
        matchId: matchIdParam,
        messageId: messageIdParam,
      });
      return;
    }

    const matchId = matchIdParam;
    const messageId = messageIdParam;
    const messageData = toRtdbMessage(event.data.val());

    if (messageData === null) {
      logger.warn("onNewMessage: message data is invalid, skipping", {
        matchId,
        messageId,
      });
      return;
    }

    const {senderId} = messageData;
    const db = admin.firestore();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      logger.warn("onNewMessage: match document not found", {matchId});
      return;
    }

    const users = toUserTuple(matchSnap.get("users"));
    if (users === null) {
      logger.warn("onNewMessage: match users are invalid", {matchId});
      return;
    }

    if (!users.includes(senderId)) {
      logger.warn("onNewMessage: sender is not in match users", {
        matchId,
        senderId,
      });
      return;
    }

    const recipientId = users[0] === senderId ? users[1] : users[0];
    const unreadKey = `${recipientId}_unread`;

    await matchRef.update({
      [unreadKey]: FieldValue.increment(1),
    });

    const prefsSnap = await db
      .doc(`users/${recipientId}/notificationPreferences/prefs`)
      .get();
    const prefsData: unknown = prefsSnap.data();

    if (!isNotificationPreferenceEnabled(prefsData, "newMessages")) {
      logger.info("onNewMessage: new-message push disabled by preference", {
        recipientId,
        matchId,
      });
      return;
    }

    const [recipientSnap, senderSnap] = await Promise.all([
      db.doc(`users/${recipientId}`).get(),
      db.doc(`users/${senderId}`).get(),
    ]);

    if (!recipientSnap.exists) {
      logger.warn("onNewMessage: recipient user not found", {recipientId});
      return;
    }

    const tokenValue = getOptionalString(recipientSnap.get("expoPushToken"));
    const expoPushToken = tokenValue?.trim();

    if (expoPushToken === undefined || expoPushToken.length === 0) {
      logger.info("onNewMessage: recipient has no push token, skipping push", {
        recipientId,
      });
      return;
    }

    if (!isExpoPushToken(expoPushToken)) {
      logger.warn("onNewMessage: unexpected push token format", {
        recipientId,
      });
      return;
    }

    const senderFirstName = senderSnap.exists ?
      getOptionalString(senderSnap.get("firstName"))?.trim() :
      undefined;
    const senderName =
      senderFirstName !== undefined && senderFirstName.length > 0 ?
        senderFirstName :
        "Someone";

    await sendExpoPushNotification({
      to: expoPushToken,
      title: senderName,
      body: buildNotificationBody(messageData),
      sound: "default",
      data: {
        type: "message",
        matchId,
        senderId,
      },
    }, "onNewMessage");

    logger.info("onNewMessage: push processing completed", {
      recipientId,
      matchId,
      messageId,
    });
  }
);

function toRtdbMessage(value: unknown): RtdbMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const senderId = getOptionalString(value.senderId);
  const text = getNullableString(value.text);
  const imageUrl = getNullableString(value.imageUrl);
  const timestamp = getNumber(value.timestamp);
  const read = getBoolean(value.read);

  if (
    senderId === undefined ||
    text === undefined ||
    imageUrl === undefined ||
    timestamp === null ||
    read === null
  ) {
    return null;
  }

  return {
    senderId,
    text,
    imageUrl,
    timestamp,
    read,
  };
}

function toUserTuple(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const firstUserId = value[0];
  const secondUserId = value[1];

  if (typeof firstUserId !== "string" || typeof secondUserId !== "string") {
    return null;
  }

  return [firstUserId, secondUserId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
