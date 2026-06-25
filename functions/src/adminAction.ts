import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type AdminAction = "ban" | "unban" | "warn" | "dismiss";
type SourceCollection = "admin_queue" | "flags" | "reports";

interface AdminActionPayload {
  action: AdminAction;
  targetId: string;
  reason: string;
  sourceCollection: SourceCollection;
  sourceDocId: string;
}

interface AdminActionResult {
  success: true;
}

const REGION = "asia-southeast1";
const DIRECT_SOURCE_DOC_ID = "direct";

// <!-- ARCHITECT: test task needed for adminAction callable coverage. -->
// <!-- ARCHITECT NOTE: Admin claim is checked via request.auth.token.admin rather
// than admin.auth().getUser() to avoid an extra Admin SDK round-trip. Firebase
// propagates custom claims into the ID token after token refresh/sign-in. -->

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isAdminAction = (value: unknown): value is AdminAction => {
  return (
    value === "ban" ||
    value === "unban" ||
    value === "warn" ||
    value === "dismiss"
  );
};

const isSourceCollection = (value: unknown): value is SourceCollection => {
  return value === "admin_queue" || value === "flags" || value === "reports";
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isAdminActionPayload = (
  value: unknown
): value is AdminActionPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isAdminAction(value.action) &&
    isNonEmptyString(value.targetId) &&
    typeof value.reason === "string" &&
    isSourceCollection(value.sourceCollection) &&
    isNonEmptyString(value.sourceDocId)
  );
};

const shouldUpdateSourceDocument = (sourceDocId: string): boolean => {
  return sourceDocId !== DIRECT_SOURCE_DOC_ID;
};

const markSourceActioned = (
  batch: admin.firestore.WriteBatch,
  db: admin.firestore.Firestore,
  sourceCollection: SourceCollection,
  sourceDocId: string
): void => {
  if (!shouldUpdateSourceDocument(sourceDocId)) {
    return;
  }

  batch.update(db.collection(sourceCollection).doc(sourceDocId), {
    status: "actioned",
  });
};

export const adminAction = onCall(
  {region: REGION},
  async (
    request: CallableRequest<unknown>
  ): Promise<AdminActionResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    if (request.auth.token["admin"] !== true) {
      throw new HttpsError("permission-denied", "admin-only");
    }

    if (!isAdminActionPayload(request.data)) {
      throw new HttpsError("invalid-argument", "Invalid admin action payload");
    }

    const {
      action,
      targetId,
      reason,
      sourceCollection,
      sourceDocId,
    } = request.data;
    const db = admin.firestore();
    const batch = db.batch();
    const adminUid = request.auth.uid;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const targetUserRef = db.collection("users").doc(targetId);

    try {
      if (action === "ban") {
        batch.update(targetUserRef, {banned: true});
        markSourceActioned(batch, db, sourceCollection, sourceDocId);
      }

      if (action === "unban") {
        batch.update(targetUserRef, {banned: false});
      }

      if (action === "warn") {
        batch.set(targetUserRef.collection("warnings").doc(), {
          reason,
          createdAt: now,
          adminUid,
        });
        markSourceActioned(batch, db, sourceCollection, sourceDocId);
      }

      if (action === "dismiss") {
        markSourceActioned(batch, db, sourceCollection, sourceDocId);
      }

      batch.set(db.collection("admin_audit").doc(), {
        action,
        targetId,
        sourceCollection,
        sourceDocId,
        reason,
        adminUid,
        createdAt: now,
      });

      await batch.commit();

      return {success: true};
    } catch {
      throw new HttpsError("internal", "Action failed");
    }
  }
);
