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

interface ExchangeStravaTokenData {
  code: string;
}

interface ExchangeStravaTokenResponse {
  success: boolean;
}

interface StravaTokenResponse {
  tokenType: string;
  expiresAt: number;
  expiresIn: number;
  refreshToken: string;
  accessToken: string;
}

interface StravaEnvironment {
  clientId: string;
  clientSecret: string;
  encryptionKeyHex: string;
}

const REGION = "asia-southeast1";
const STRAVA_TOKEN_ENDPOINT = "https://www.strava.com/oauth/token";
const ENCRYPTION_KEY_HEX_LENGTH = 64;
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

const getExchangeStravaTokenData = (
  data: unknown
): ExchangeStravaTokenData => {
  if (!isRecord(data) || typeof data.code !== "string") {
    throw new HttpsError("invalid-argument", "code is required.");
  }

  const code = data.code.trim();

  if (code.length === 0) {
    throw new HttpsError("invalid-argument", "code is required.");
  }

  return {code};
};

const toStravaTokenResponse = (
  value: unknown
): StravaTokenResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const tokenType = getString(value.token_type);
  const expiresAt = getNumber(value.expires_at);
  const expiresIn = getNumber(value.expires_in);
  const refreshToken = getString(value.refresh_token);
  const accessToken = getString(value.access_token);

  if (
    tokenType === null ||
    expiresAt === null ||
    expiresIn === null ||
    refreshToken === null ||
    accessToken === null
  ) {
    return null;
  }

  return {
    tokenType,
    expiresAt,
    expiresIn,
    refreshToken,
    accessToken,
  };
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

const exchangeCodeForTokens = async (
  code: string,
  environment: StravaEnvironment
): Promise<StravaTokenResponse> => {
  const body = new URLSearchParams({
    client_id: environment.clientId,
    client_secret: environment.clientSecret,
    code,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!tokenResponse.ok) {
    logger.error("exchangeStravaToken: token exchange failed", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
    });
    throw new HttpsError("internal", "Strava token exchange failed.");
  }

  let responseValue: unknown;

  try {
    responseValue = await tokenResponse.json();
  } catch (error: unknown) {
    logger.error("exchangeStravaToken: token response parse failed", {
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

export const exchangeStravaToken = onCall(
  {region: REGION, secrets: STRAVA_SECRET_NAMES},
  async (
    request: CallableRequest<ExchangeStravaTokenData>
  ): Promise<ExchangeStravaTokenResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = request.auth.uid;
    const {code} = getExchangeStravaTokenData(request.data);
    const environment = getStravaEnvironment();
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const tokens = await exchangeCodeForTokens(code, environment);
    const encryptedRefreshToken = encryptToken(
      tokens.refreshToken,
      environment.encryptionKeyHex
    );

    await userRef.update({
      "fitnessTracking.strava.connected": true,
      "fitnessTracking.strava.accessToken": tokens.accessToken,
      "fitnessTracking.strava.refreshToken": encryptedRefreshToken,
      "fitnessTracking.strava.expiresAt": tokens.expiresAt,
      "fitnessTracking.strava.lastSync":
        admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true};
  }
);
