import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";

import {decryptTokenOrLegacy, isValidEncryptionKey} from "./utils/crypto";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const STRAVA_DEAUTHORIZE_ENDPOINT =
  "https://www.strava.com/oauth/deauthorize";
const STRAVA_TOKEN_ENCRYPTION_SECRET = "STRAVA_TOKEN_ENCRYPTION_KEY";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getStravaData = (
  data: FirebaseFirestore.DocumentData
): Record<string, unknown> | null => {
  const fitnessTracking: unknown = data.fitnessTracking;

  if (!isRecord(fitnessTracking)) {
    return null;
  }

  const strava: unknown = fitnessTracking.strava;
  return isRecord(strava) ? strava : null;
};

const getStravaConnected = (
  data: FirebaseFirestore.DocumentData
): boolean | null => {
  const strava = getStravaData(data);

  if (strava === null || typeof strava.connected !== "boolean") {
    return null;
  }

  return strava.connected;
};

const getStravaAccessToken = (
  data: FirebaseFirestore.DocumentData
): string | null => {
  const strava = getStravaData(data);

  if (strava === null || typeof strava.accessToken !== "string") {
    return null;
  }

  return strava.accessToken;
};

const getTokenEncryptionKey = (): string => {
  const encryptionKeyHex =
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim();

  if (
    encryptionKeyHex === undefined ||
    !isValidEncryptionKey(encryptionKeyHex)
  ) {
    throw new Error("Strava token encryption key is invalid.");
  }

  return encryptionKeyHex;
};

const revokeStravaToken = async (
  encryptedAccessToken: string
): Promise<void> => {
  const accessToken = decryptTokenOrLegacy(
    encryptedAccessToken,
    getTokenEncryptionKey()
  );
  const body = new URLSearchParams({access_token: accessToken});

  await fetch(STRAVA_DEAUTHORIZE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
};

export const onStravaDisconnected = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "asia-southeast1",
    secrets: [STRAVA_TOKEN_ENCRYPTION_SECRET],
  },
  async (event): Promise<void> => {
    const change = event.data;

    if (change === undefined) {
      return;
    }

    const before = change.before.data();
    const after = change.after.data();

    if (
      getStravaConnected(before) !== true ||
      getStravaConnected(after) !== false
    ) {
      return;
    }

    const encryptedAccessToken = getStravaAccessToken(before);

    if (encryptedAccessToken !== null) {
      try {
        await revokeStravaToken(encryptedAccessToken);
      } catch {
        // Revocation is best-effort; credential deletion below must still run.
      }
    }

    await change.after.ref.update({
      // These credential fields are optional and server-managed, so disconnect removes
      // them rather than leaving stale encrypted tokens on the user document.
      "fitnessTracking.strava.accessToken": FieldValue.delete(),
      "fitnessTracking.strava.refreshToken": FieldValue.delete(),
      "fitnessTracking.strava.expiresAt": FieldValue.delete(),
    });
  }
);
