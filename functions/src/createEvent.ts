import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface CreateEventData {
  title: string;
  description: string;
  activityType: string;
  locationName: string;
  locationAddress: string;
  locationPlaceId: string;
  locationLatitude: number;
  locationLongitude: number;
  startAt: number;
  endAt: number;
  maxAttendees: number | null;
  city: string;
  country: string;
}

interface CreateEventResult {
  eventId: string;
}

const REGION = "asia-southeast1";
const MIN_TITLE_LENGTH = 5;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidCoordinate = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const isValidLatitude = (value: unknown): value is number => {
  return isValidCoordinate(value) && value >= -90 && value <= 90;
};

const isValidLongitude = (value: unknown): value is number => {
  return isValidCoordinate(value) && value >= -180 && value <= 180;
};

const isValidUnixMillis = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
};

const isValidMaxAttendees = (value: unknown): value is number | null => {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      Number.isFinite(value) &&
      value > 0)
  );
};

const getCreateEventData = (value: unknown): CreateEventData => {
  if (!isRecord(value)) {
    throw new HttpsError("invalid-argument", "event-data-required");
  }

  if (
    !isNonEmptyString(value.title) ||
    value.title.trim().length < MIN_TITLE_LENGTH
  ) {
    throw new HttpsError("invalid-argument", "title-too-short");
  }

  if (!isNonEmptyString(value.description)) {
    throw new HttpsError("invalid-argument", "description-required");
  }

  if (!isNonEmptyString(value.activityType)) {
    throw new HttpsError("invalid-argument", "activity-type-required");
  }

  if (
    !isNonEmptyString(value.locationName) ||
    !isNonEmptyString(value.locationAddress) ||
    typeof value.locationPlaceId !== "string" ||
    !isValidLatitude(value.locationLatitude) ||
    !isValidLongitude(value.locationLongitude) ||
    !isNonEmptyString(value.city) ||
    !isNonEmptyString(value.country)
  ) {
    throw new HttpsError("invalid-argument", "location-required");
  }

  if (!isValidUnixMillis(value.startAt)) {
    throw new HttpsError("invalid-argument", "start-must-be-future");
  }

  if (!isValidUnixMillis(value.endAt)) {
    throw new HttpsError("invalid-argument", "end-must-be-after-start");
  }

  if (!isValidMaxAttendees(value.maxAttendees)) {
    throw new HttpsError("invalid-argument", "max-attendees-invalid");
  }

  return {
    title: value.title.trim(),
    description: value.description.trim(),
    activityType: value.activityType.trim(),
    locationName: value.locationName.trim(),
    locationAddress: value.locationAddress.trim(),
    locationPlaceId: value.locationPlaceId.trim(),
    locationLatitude: value.locationLatitude,
    locationLongitude: value.locationLongitude,
    startAt: value.startAt,
    endAt: value.endAt,
    maxAttendees: value.maxAttendees,
    city: value.city.trim(),
    country: value.country.trim(),
  };
};

export const createEvent = onCall(
  {region: REGION},
  async (
    request: CallableRequest<CreateEventData>
  ): Promise<CreateEventResult> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const data = getCreateEventData(request.data);
    const now = Date.now();

    if (data.startAt <= now) {
      throw new HttpsError("invalid-argument", "start-must-be-future");
    }

    if (data.endAt <= data.startAt) {
      throw new HttpsError("invalid-argument", "end-must-be-after-start");
    }

    const db = admin.firestore();
    const eventRef = db.collection("events").doc();

    await eventRef.set({
      creatorId: uid,
      title: data.title,
      description: data.description,
      activityType: data.activityType,
      location: {
        name: data.locationName,
        address: data.locationAddress,
        coordinates: new admin.firestore.GeoPoint(
          data.locationLatitude,
          data.locationLongitude
        ),
        placeId: data.locationPlaceId,
      },
      startAt: admin.firestore.Timestamp.fromMillis(data.startAt),
      endAt: admin.firestore.Timestamp.fromMillis(data.endAt),
      maxAttendees: data.maxAttendees,
      attendees: [uid],
      city: data.city,
      country: data.country,
      cancelled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {eventId: eventRef.id};
  }
);
