import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type RsvpAction = "join" | "leave";

interface RsvpEventData {
  eventId: string;
  action: RsvpAction;
}

interface RsvpEventResult {
  attendees: string[];
}

const REGION = "asia-southeast1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isRsvpAction = (value: unknown): value is RsvpAction => {
  return value === "join" || value === "leave";
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const getRsvpEventData = (value: unknown): RsvpEventData => {
  if (!isRecord(value) || typeof value.eventId !== "string") {
    throw new HttpsError("invalid-argument", "event-id-required");
  }

  if (value.eventId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "event-id-required");
  }

  if (!isRsvpAction(value.action)) {
    throw new HttpsError("invalid-argument", "invalid-action");
  }

  return {
    eventId: value.eventId.trim(),
    action: value.action,
  };
};

const getMaxAttendees = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0
  ) {
    return value;
  }

  return null;
};

export const rsvpEvent = onCall(
  {region: REGION},
  async (
    request: CallableRequest<RsvpEventData>
  ): Promise<RsvpEventResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const {eventId, action} = getRsvpEventData(request.data);
    const db = admin.firestore();
    const eventRef = db.collection("events").doc(eventId);
    let attendees: string[] = [];

    await db.runTransaction(async (transaction): Promise<void> => {
      const eventSnap = await transaction.get(eventRef);

      if (!eventSnap.exists) {
        throw new HttpsError("not-found", "event-not-found");
      }

      const eventData: unknown = eventSnap.data();

      if (!isRecord(eventData)) {
        throw new HttpsError("not-found", "event-not-found");
      }

      if (eventData["cancelled"] === true) {
        throw new HttpsError("failed-precondition", "event-cancelled");
      }

      const currentAttendees = isStringArray(eventData["attendees"])
        ? eventData["attendees"]
        : [];
      const maxAttendees = getMaxAttendees(eventData["maxAttendees"]);

      if (action === "join") {
        const alreadyAttending = currentAttendees.includes(uid);

        if (
          !alreadyAttending &&
          maxAttendees !== null &&
          currentAttendees.length >= maxAttendees
        ) {
          throw new HttpsError("failed-precondition", "event-full");
        }

        attendees = alreadyAttending
          ? currentAttendees
          : [...currentAttendees, uid];

        transaction.update(eventRef, {
          attendees: admin.firestore.FieldValue.arrayUnion(uid),
        });
        return;
      }

      attendees = currentAttendees.filter((attendeeId) => attendeeId !== uid);

      transaction.update(eventRef, {
        attendees: admin.firestore.FieldValue.arrayRemove(uid),
      });
    });

    return {attendees};
  }
);
