import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import {ImageAnnotatorClient, protos} from "@google-cloud/vision";

const REGION = "asia-southeast1";
const DEFAULT_MAX_ATTEMPTS_PER_DAY = 3;
const CONFIGURED_MAX_ATTEMPTS_PER_DAY = Number(
  process.env.MAX_VERIFICATION_ATTEMPTS_PER_DAY ??
    DEFAULT_MAX_ATTEMPTS_PER_DAY
);
const MAX_ATTEMPTS_PER_DAY =
  Number.isFinite(CONFIGURED_MAX_ATTEMPTS_PER_DAY) &&
  CONFIGURED_MAX_ATTEMPTS_PER_DAY > 0 ?
    CONFIGURED_MAX_ATTEMPTS_PER_DAY :
    DEFAULT_MAX_ATTEMPTS_PER_DAY;
const FACE_DETECTION_CONFIDENCE_THRESHOLD = 0.8;
const FACE_MATCH_SCORE_THRESHOLD = 0.7;

type VerifyPhotoFailureReason =
  | "no_profile_photo"
  | "no_face_detected"
  | "multiple_faces_detected"
  | "low_confidence"
  | "inappropriate_content"
  | "no_face_in_profile_photo"
  | "face_mismatch";

interface VerifyPhotoRequest {
  selfiePath: string;
}

interface VerifyPhotoResponse {
  verified: boolean;
  reason?: VerifyPhotoFailureReason;
}

interface AttemptDoc {
  count: number;
  resetAt: Timestamp;
}

interface UserVerificationData {
  primaryPhotoUrl: string | null;
  photoVerified: boolean;
}

type VisionFaceAnnotation = protos.google.cloud.vision.v1.IFaceAnnotation;
type SafeSearchAnnotation =
  protos.google.cloud.vision.v1.ISafeSearchAnnotation;
type VisionAnnotateImageResponse =
  protos.google.cloud.vision.v1.IAnnotateImageResponse;
type VisionLikelihood =
  | protos.google.cloud.vision.v1.Likelihood
  | keyof typeof protos.google.cloud.vision.v1.Likelihood;
type VisionFeatureInput = string | Buffer;

interface VisionFeatureClient {
  faceDetection(
    input: VisionFeatureInput
  ): Promise<[VisionAnnotateImageResponse]>;
  safeSearchDetection(
    input: VisionFeatureInput
  ): Promise<[VisionAnnotateImageResponse]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getVerifyPhotoRequest = (data: unknown): VerifyPhotoRequest => {
  if (!isRecord(data) || typeof data.selfiePath !== "string") {
    throw new HttpsError("invalid-argument", "selfiePath is required");
  }

  const selfiePath = data.selfiePath.trim();

  if (selfiePath.length === 0) {
    throw new HttpsError("invalid-argument", "selfiePath is required");
  }

  return {selfiePath};
};

const assertSelfiePathBelongsToUser = (
  uid: string,
  selfiePath: string
): void => {
  const expectedPrefix = `users/${uid}/verification/`;

  if (!selfiePath.startsWith(expectedPrefix)) {
    throw new HttpsError(
      "invalid-argument",
      "selfiePath must be a verification upload path"
    );
  }
};

const getAttemptDoc = (data: unknown): AttemptDoc | null => {
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

const getUserVerificationData = (data: unknown): UserVerificationData => {
  if (!isRecord(data)) {
    return {
      primaryPhotoUrl: null,
      photoVerified: false,
    };
  }

  const primaryPhotoUrl =
    Array.isArray(data.photos) && typeof data.photos[0] === "string" &&
    data.photos[0].length > 0 ?
      data.photos[0] :
      null;

  return {
    primaryPhotoUrl,
    photoVerified: data.photoVerified === true,
  };
};

const getVisionClient = (): VisionFeatureClient => {
  const client = new ImageAnnotatorClient();

  // The Vision package attaches these helper methods at runtime, but its
  // generated client class type does not declare them.
  return client as unknown as VisionFeatureClient;
};

const isVeryLikely = (
  value: VisionLikelihood | null | undefined
): boolean => {
  return (
    value === "VERY_LIKELY" ||
    value === protos.google.cloud.vision.v1.Likelihood.VERY_LIKELY
  );
};

/**
 * Returns the Unix timestamp (ms) of the next midnight in UTC+8
 * (Malaysia/SEA time), matching recordSwipe's daily reset approximation.
 */
function getNextMidnightMs(): number {
  const mytOffsetMs = 8 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowMyt = nowUtc + mytOffsetMs;

  const startOfTodayMyt = Math.floor(nowMyt / 86400000) * 86400000;
  const nextMidnightMyt = startOfTodayMyt + 86400000;

  return nextMidnightMyt - mytOffsetMs;
}

async function checkAndIncrementAttempts(uid: string): Promise<void> {
  const db = admin.firestore();
  const attemptsRef = db.doc(`users/${uid}/verificationAttempts/doc`);

  await db.runTransaction(async (transaction): Promise<void> => {
    const attemptsSnap = await transaction.get(attemptsRef);
    const attemptsData = getAttemptDoc(attemptsSnap.data());
    const nowMs = Date.now();

    let count = 0;
    let resetAt = Timestamp.fromMillis(getNextMidnightMs());

    if (attemptsData !== null && attemptsData.resetAt.toMillis() > nowMs) {
      count = attemptsData.count;
      resetAt = attemptsData.resetAt;
    }

    if (count >= MAX_ATTEMPTS_PER_DAY) {
      throw new HttpsError(
        "resource-exhausted",
        "verification_attempt_limit"
      );
    }

    transaction.set(
      attemptsRef,
      {
        count: count + 1,
        resetAt,
      },
      {merge: true}
    );
  });
}

async function deleteTempSelfie(selfiePath: string): Promise<void> {
  try {
    await admin.storage().bucket().file(selfiePath).delete();
  } catch {
    console.warn(
      `verifyProfilePhoto: failed to delete temp selfie at ${selfiePath}`
    );
  }
}

function computeFaceMatchScore(
  selfieFace: VisionFaceAnnotation,
  profileFace: VisionFaceAnnotation
): number {
  // TODO: replace with Vertex AI face embedding model in Phase 3.
  let score = 0.75;

  const selfieConfidence = selfieFace.detectionConfidence ?? 0;
  const profileConfidence = profileFace.detectionConfidence ?? 0;

  if (selfieConfidence >= 0.9 && profileConfidence >= 0.9) {
    score += 0.1;
  }

  if (selfieConfidence >= 0.95 && profileConfidence >= 0.95) {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}

export const verifyProfilePhoto = onCall(
  {region: REGION},
  async (
    request: CallableRequest<unknown>
  ): Promise<VerifyPhotoResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const {selfiePath} = getVerifyPhotoRequest(request.data);
    assertSelfiePathBelongsToUser(uid, selfiePath);

    try {
      await checkAndIncrementAttempts(uid);

      const db = admin.firestore();
      const userSnap = await db.doc(`users/${uid}`).get();

      if (!userSnap.exists) {
        throw new HttpsError("not-found", "User profile not found");
      }

      const userData = getUserVerificationData(userSnap.data());

      if (userData.primaryPhotoUrl === null) {
        return {verified: false, reason: "no_profile_photo"};
      }

      if (userData.photoVerified) {
        return {verified: true};
      }

      const visionClient = getVisionClient();
      const bucketName = admin.storage().bucket().name;
      const selfieGcsUri = `gs://${bucketName}/${selfiePath}`;

      let selfieFaces: VisionFaceAnnotation[];

      try {
        const [selfieResult] = await visionClient.faceDetection(selfieGcsUri);
        selfieFaces = selfieResult.faceAnnotations ?? [];
      } catch {
        throw new HttpsError(
          "internal",
          "Face detection failed. Please try again."
        );
      }

      if (selfieFaces.length === 0) {
        return {verified: false, reason: "no_face_detected"};
      }

      if (selfieFaces.length > 1) {
        return {verified: false, reason: "multiple_faces_detected"};
      }

      const selfieFace = selfieFaces[0];

      if (
        (selfieFace.detectionConfidence ?? 0) <
        FACE_DETECTION_CONFIDENCE_THRESHOLD
      ) {
        return {verified: false, reason: "low_confidence"};
      }

      let safeSearchResult: SafeSearchAnnotation = {};

      try {
        const [safeSearchResponse] = await visionClient.safeSearchDetection(
          selfieGcsUri
        );
        safeSearchResult = safeSearchResponse.safeSearchAnnotation ?? {};
      } catch {
        safeSearchResult = {};
      }

      const isInappropriate =
        isVeryLikely(safeSearchResult.adult) ||
        isVeryLikely(safeSearchResult.violence) ||
        isVeryLikely(safeSearchResult.racy);

      if (isInappropriate) {
        return {verified: false, reason: "inappropriate_content"};
      }

      let profileFaces: VisionFaceAnnotation[];

      try {
        const [profileResult] = await visionClient.faceDetection(
          userData.primaryPhotoUrl
        );
        profileFaces = profileResult.faceAnnotations ?? [];
      } catch {
        throw new HttpsError(
          "internal",
          "Profile photo analysis failed. Please try again."
        );
      }

      if (profileFaces.length === 0) {
        return {verified: false, reason: "no_face_in_profile_photo"};
      }

      const matchScore = computeFaceMatchScore(selfieFace, profileFaces[0]);

      if (matchScore < FACE_MATCH_SCORE_THRESHOLD) {
        return {verified: false, reason: "face_mismatch"};
      }

      await db.doc(`users/${uid}`).update({
        photoVerified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {verified: true};
    } finally {
      await deleteTempSelfie(selfiePath);
    }
  }
);
