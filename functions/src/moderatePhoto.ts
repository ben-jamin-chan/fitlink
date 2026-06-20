import * as admin from "firebase-admin";
import {ImageAnnotatorClient, protos} from "@google-cloud/vision";
import {onObjectFinalized} from "firebase-functions/v2/storage";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type SafeSearchAnnotation =
  protos.google.cloud.vision.v1.ISafeSearchAnnotation;
type VisionAnnotateImageResponse =
  protos.google.cloud.vision.v1.IAnnotateImageResponse;
type VisionLikelihood =
  | protos.google.cloud.vision.v1.Likelihood
  | keyof typeof protos.google.cloud.vision.v1.Likelihood;

interface VisionSafeSearchClient {
  safeSearchDetection(
    input: string
  ): Promise<[VisionAnnotateImageResponse]>;
}

interface FlagEntry {
  userId: string;
  photoUrl: string;
  reason: string;
  safeSearch: SafeSearchAnnotation;
  status: "pending" | "reviewed" | "actioned";
  createdAt: admin.firestore.FieldValue;
}

const REGION = "asia-southeast1";

const getProfilePhotoUserId = (filePath: string): string | null => {
  const pathParts = filePath.split("/");

  if (
    pathParts.length !== 4 ||
    pathParts[0] !== "users" ||
    pathParts[2] !== "photos" ||
    pathParts[1].length === 0 ||
    pathParts[3].length === 0
  ) {
    return null;
  }

  return pathParts[1];
};

const getVisionClient = (): VisionSafeSearchClient => {
  const client = new ImageAnnotatorClient();

  // The Vision package attaches this helper at runtime, but its generated
  // client class type does not declare it.
  return client as unknown as VisionSafeSearchClient;
};

const isVeryLikely = (
  value: VisionLikelihood | null | undefined
): boolean => {
  return (
    value === "VERY_LIKELY" ||
    value === protos.google.cloud.vision.v1.Likelihood.VERY_LIKELY
  );
};

export const moderatePhoto = onObjectFinalized(
  {region: REGION},
  async (event): Promise<void> => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;
    const userId = getProfilePhotoUserId(filePath);

    if (userId === null) {
      return;
    }

    const photoUrl = `gs://${bucketName}/${filePath}`;
    const visionClient = getVisionClient();
    const [safeSearchResponse] = await visionClient.safeSearchDetection(
      photoUrl
    );
    const safeSearch = safeSearchResponse.safeSearchAnnotation ?? {};
    const isInappropriate =
      isVeryLikely(safeSearch.adult) ||
      isVeryLikely(safeSearch.violence) ||
      isVeryLikely(safeSearch.racy);

    if (!isInappropriate) {
      return;
    }

    const db = admin.firestore();

    await db.collection("flags").add({
      userId,
      photoUrl,
      reason: "Inappropriate content detected",
      safeSearch,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    } satisfies FlagEntry);

    await admin.storage().bucket(bucketName).file(filePath).delete();
  }
);
