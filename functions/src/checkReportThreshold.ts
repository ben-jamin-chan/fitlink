import * as admin from "firebase-admin";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface AdminQueueEntry {
  type: "auto_ban";
  reportedUserId: string;
  reportCount: number;
  status: "pending" | "reviewed" | "actioned";
  createdAt: admin.firestore.FieldValue;
}

const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REGION = "asia-southeast1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const getReportedUserId = (data: unknown): string | null => {
  if (!isRecord(data) || typeof data.reportedUserId !== "string") {
    return null;
  }

  const reportedUserId = data.reportedUserId.trim();

  return reportedUserId.length > 0 ? reportedUserId : null;
};

const getReportTimestamp = (
  data: unknown
): admin.firestore.Timestamp | null => {
  if (!isRecord(data)) {
    return null;
  }

  if (data.createdAt instanceof admin.firestore.Timestamp) {
    return data.createdAt;
  }

  if (data.reportedAt instanceof admin.firestore.Timestamp) {
    return data.reportedAt;
  }

  return null;
};

export const checkReportThreshold = onDocumentCreated(
  {
    document: "reports/{reportId}",
    region: REGION,
  },
  async (event): Promise<void> => {
    const snapshot = event.data;

    if (snapshot === undefined) {
      return;
    }

    const reportedUserId = getReportedUserId(snapshot.data());

    if (reportedUserId === null) {
      return;
    }

    const db = admin.firestore();
    const cutoffMs =
      admin.firestore.Timestamp.now().toMillis() - REPORT_WINDOW_MS;
    const recentReports = await db
      .collection("reports")
      .where("reportedUserId", "==", reportedUserId)
      .get();
    const reportCount = recentReports.docs.filter((reportDoc) => {
      const reportTimestamp = getReportTimestamp(reportDoc.data());

      return (
        reportTimestamp !== null && reportTimestamp.toMillis() >= cutoffMs
      );
    }).length;

    if (reportCount < REPORT_THRESHOLD) {
      return;
    }

    await db.doc(`users/${reportedUserId}`).update({
      banned: true,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      banReason: "Multiple reports in 24 hours",
    });

    try {
      await admin.auth().revokeRefreshTokens(reportedUserId);
    } catch {
      // Token revocation is best-effort; the Firestore ban is authoritative.
    }

    await db.collection("admin_queue").add({
      type: "auto_ban",
      reportedUserId,
      reportCount,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    } satisfies AdminQueueEntry);
  }
);
