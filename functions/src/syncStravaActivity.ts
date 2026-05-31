import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {logger} from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface StoredStravaConnection {
  connected: boolean;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface StravaTokenResponse {
  expiresAt: number;
  refreshToken: string;
  accessToken: string;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  startDate: string;
  movingTime: number;
  distance: number;
  calories: number | null;
}

interface WorkoutSummary {
  type: string;
  duration: number;
  distance?: number;
  calories?: number;
}

interface SyncStravaActivityResponse {
  steps: number;
  distance: number;
  calories: number;
  workouts: WorkoutSummary[];
}

interface StravaEnvironment {
  clientId: string;
  clientSecret: string;
  encryptionKeyHex: string;
}

const REGION = "asia-southeast1";
const STRAVA_TOKEN_ENDPOINT = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_ENDPOINT =
  "https://www.strava.com/api/v3/athlete/activities";
const ENCRYPTION_KEY_HEX_LENGTH = 64;
const STRAVA_TOKEN_REFRESH_BUFFER_SECONDS = 60;
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const UTC8_OFFSET_SECONDS = 8 * 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;
const STRAVA_SECRET_NAMES = [
  "STRAVA_CLIENT_SECRET",
  "STRAVA_TOKEN_ENCRYPTION_KEY",
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const getNumber = (value: unknown): number | null => {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const getNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return getNumber(value);
};

const isHexString = (value: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(value);
};

const isValidEncryptionKey = (value: string): boolean => {
  return (
    value.length === ENCRYPTION_KEY_HEX_LENGTH &&
    isHexString(value)
  );
};

const getStravaEnvironment = (): StravaEnvironment => {
  const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  const encryptionKeyHex =
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim();

  if (
    clientId === undefined ||
    clientId.length === 0 ||
    clientSecret === undefined ||
    clientSecret.length === 0 ||
    encryptionKeyHex === undefined ||
    encryptionKeyHex.length === 0
  ) {
    throw new HttpsError(
      "internal",
      "Strava credentials are not configured."
    );
  }

  if (!isValidEncryptionKey(encryptionKeyHex)) {
    throw new HttpsError(
      "internal",
      "Strava token encryption key is invalid."
    );
  }

  return {clientId, clientSecret, encryptionKeyHex};
};

const toStoredStravaConnection = (
  value: unknown
): StoredStravaConnection | null => {
  if (!isRecord(value)) {
    return null;
  }

  const accessToken = getString(value.accessToken);
  const refreshToken = getString(value.refreshToken);
  const expiresAt = getNumber(value.expiresAt);

  if (
    value.connected !== true ||
    accessToken === null ||
    refreshToken === null ||
    expiresAt === null
  ) {
    return null;
  }

  return {
    connected: true,
    accessToken,
    refreshToken,
    expiresAt,
  };
};

const toStravaTokenResponse = (
  value: unknown
): StravaTokenResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const expiresAt = getNumber(value.expires_at);
  const refreshToken = getString(value.refresh_token);
  const accessToken = getString(value.access_token);

  if (
    expiresAt === null ||
    refreshToken === null ||
    accessToken === null
  ) {
    return null;
  }

  return {expiresAt, refreshToken, accessToken};
};

const toStravaActivity = (value: unknown): StravaActivity | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getNumber(value.id);
  const name = getString(value.name);
  const type = getString(value.type);
  const startDate = getString(value.start_date);
  const movingTime = getNumber(value.moving_time);
  const distance = getNumber(value.distance);
  const calories = getNullableNumber(value.calories);

  if (
    id === null ||
    name === null ||
    type === null ||
    startDate === null ||
    movingTime === null ||
    distance === null
  ) {
    return null;
  }

  return {
    id,
    name,
    type,
    startDate,
    movingTime,
    distance,
    calories,
  };
};

const toStravaActivities = (value: unknown): StravaActivity[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const activities: StravaActivity[] = [];

  for (const item of value) {
    const activity = toStravaActivity(item);

    if (activity !== null) {
      activities.push(activity);
    }
  }

  return activities;
};

const encryptToken = (plaintext: string, keyHex: string): string => {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptToken = (ciphertext: string, keyHex: string): string => {
  const [ivHex, encryptedHex] = ciphertext.split(":");

  if (
    ivHex === undefined ||
    encryptedHex === undefined ||
    ivHex.length === 0 ||
    encryptedHex.length === 0
  ) {
    throw new HttpsError("internal", "Encrypted Strava token is invalid.");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const getTodayStartUnix = (nowUnix: number): number => {
  const nowUtc8 = nowUnix + UTC8_OFFSET_SECONDS;
  const todayStartUtc8 =
    Math.floor(nowUtc8 / SECONDS_PER_DAY) * SECONDS_PER_DAY;

  return todayStartUtc8 - UTC8_OFFSET_SECONDS;
};

const refreshAccessToken = async (
  refreshToken: string,
  environment: StravaEnvironment
): Promise<StravaTokenResponse> => {
  const body = new URLSearchParams({
    client_id: environment.clientId,
    client_secret: environment.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const refreshResponse = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!refreshResponse.ok) {
    logger.error("syncStravaActivity: token refresh failed", {
      status: refreshResponse.status,
      statusText: refreshResponse.statusText,
    });
    throw new HttpsError("internal", "Failed to refresh Strava token.");
  }

  let responseValue: unknown;

  try {
    responseValue = await refreshResponse.json();
  } catch (error: unknown) {
    logger.error("syncStravaActivity: token refresh parse failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new HttpsError("internal", "Strava token response was invalid.");
  }

  const tokens = toStravaTokenResponse(responseValue);

  if (tokens === null) {
    throw new HttpsError("internal", "Strava token response was invalid.");
  }

  return tokens;
};

const fetchStravaActivities = async (
  accessToken: string,
  afterUnix: number
): Promise<StravaActivity[]> => {
  const params = new URLSearchParams({
    after: afterUnix.toString(),
    per_page: "50",
  });
  const activitiesResponse = await fetch(
    `${STRAVA_ACTIVITIES_ENDPOINT}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!activitiesResponse.ok) {
    logger.error("syncStravaActivity: activities fetch failed", {
      status: activitiesResponse.status,
      statusText: activitiesResponse.statusText,
    });
    throw new HttpsError("internal", "Failed to fetch Strava activities.");
  }

  let responseValue: unknown;

  try {
    responseValue = await activitiesResponse.json();
  } catch (error: unknown) {
    logger.error("syncStravaActivity: activities response parse failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new HttpsError(
      "internal",
      "Strava activities response was invalid."
    );
  }

  const activities = toStravaActivities(responseValue);

  if (activities === null) {
    throw new HttpsError(
      "internal",
      "Strava activities response was invalid."
    );
  }

  return activities;
};

const getWorkoutSummary = (activity: StravaActivity): WorkoutSummary => {
  const workout: WorkoutSummary = {
    type: activity.type,
    duration: Math.round(activity.movingTime / 60),
  };

  if (activity.distance > 0) {
    workout.distance = Math.round((activity.distance / 1000) * 10) / 10;
  }

  if (activity.calories !== null) {
    workout.calories = activity.calories;
  }

  return workout;
};

const getTodayStats = (
  activities: StravaActivity[],
  todayStartUnix: number
): SyncStravaActivityResponse => {
  const todayActivities = activities.filter((activity) => {
    const activityUnix = Math.floor(Date.parse(activity.startDate) / 1000);
    return Number.isFinite(activityUnix) && activityUnix >= todayStartUnix;
  });
  const totalDistanceKm =
    todayActivities.reduce((sum, activity) => {
      return sum + activity.distance;
    }, 0) / 1000;
  const totalCalories = todayActivities.reduce((sum, activity) => {
    return sum + (activity.calories ?? 0);
  }, 0);

  return {
    steps: 0,
    distance: Math.round(totalDistanceKm * 10) / 10,
    calories: Math.round(totalCalories),
    workouts: todayActivities.map(getWorkoutSummary),
  };
};

export const syncStravaActivity = onCall(
  {region: REGION, secrets: STRAVA_SECRET_NAMES},
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<SyncStravaActivityResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = request.auth.uid;
    const environment = getStravaEnvironment();
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const stravaData = toStoredStravaConnection(
      userSnap.get("fitnessTracking.strava")
    );

    if (stravaData === null) {
      throw new HttpsError(
        "failed-precondition",
        "Strava is not connected for this user."
      );
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    let accessToken = stravaData.accessToken;

    if (
      nowUnix >=
      stravaData.expiresAt - STRAVA_TOKEN_REFRESH_BUFFER_SECONDS
    ) {
      const decryptedRefreshToken = decryptToken(
        stravaData.refreshToken,
        environment.encryptionKeyHex
      );
      const refreshed = await refreshAccessToken(
        decryptedRefreshToken,
        environment
      );

      accessToken = refreshed.accessToken;

      await userRef.update({
        "fitnessTracking.strava.accessToken": accessToken,
        "fitnessTracking.strava.refreshToken": encryptToken(
          refreshed.refreshToken,
          environment.encryptionKeyHex
        ),
        "fitnessTracking.strava.expiresAt": refreshed.expiresAt,
      });
    }

    const activities = await fetchStravaActivities(
      accessToken,
      nowUnix - SEVEN_DAYS_SECONDS
    );
    const stats = getTodayStats(activities, getTodayStartUnix(nowUnix));

    await userRef.update({
      "fitnessTracking.todayStats": {
        ...stats,
        source: "strava",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      "fitnessTracking.strava.lastSync":
        admin.firestore.FieldValue.serverTimestamp(),
    });

    return stats;
  }
);
