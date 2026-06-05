import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const getPrimaryPhoto = (data: FirebaseFirestore.DocumentData): string | null => {
  const photos: unknown = data.photos;

  if (!Array.isArray(photos) || typeof photos[0] !== "string") {
    return null;
  }

  return photos[0];
};

export const onPrimaryPhotoChanged = onDocumentUpdated(
  {
    document: "users/{uid}",
    region: "asia-southeast1",
  },
  async (event): Promise<void> => {
    const change = event.data;

    if (change === undefined) {
      return;
    }

    const before = change.before.data();
    const after = change.after.data();
    const beforePrimaryPhoto = getPrimaryPhoto(before);
    const afterPrimaryPhoto = getPrimaryPhoto(after);

    if (
      beforePrimaryPhoto === afterPrimaryPhoto ||
      after.photoVerified !== true
    ) {
      return;
    }

    await change.after.ref.update({
      photoVerified: false,
      verifiedAt: FieldValue.delete(),
    });
  }
);
