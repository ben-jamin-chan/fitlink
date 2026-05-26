import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

const getServerManagedUserDefaults = (
  age: number,
  banned: boolean
): Record<string, unknown> => {
  return {
    age,
    stats: {likes: 0, passes: 0, matches: 0},
    premium: {
      active: false,
      tier: null,
      subscriptionId: null,
      expiresAt: null,
    },
    photoVerified: false,
    banned,
    lastActive: FieldValue.serverTimestamp(),
  };
};

/**
 * Triggered when a new user document is created in /users/{uid} at
 * onboarding Step 6 completion.
 *
 * Responsibilities:
 * - Calculate age server-side from dateOfBirth.
 * - Auto-ban accounts where calculated age < 18.
 * - Write age, and ban metadata when applicable, back to the user document.
 *
 * The client intentionally omits `age` from its createUserProfile() write.
 * This function is the authoritative source of truth for the age field.
 */
export const onUserCreated = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-southeast1",
  },
  async (event): Promise<void> => {
    const uid = event.params.uid;
    const snapshot = event.data;

    if (snapshot === undefined) {
      console.error(`onUserCreated: no data for uid=${uid}`);
      return;
    }

    const data = snapshot.data();
    const dateOfBirth: unknown = data.dateOfBirth;

    if (!(dateOfBirth instanceof Timestamp)) {
      console.error(
        `onUserCreated: missing dateOfBirth for uid=${uid}. Skipping age calculation.`
      );
      return;
    }

    const age = calculateAgeInYears(dateOfBirth.toDate());

    if (age < 18) {
      await db.doc(`users/${uid}`).update({
        ...getServerManagedUserDefaults(age, true),
        banReason: "UNDERAGE",
        bannedAt: FieldValue.serverTimestamp(),
      });

      console.warn(
        `onUserCreated: uid=${uid} is under 18 (age=${age}). Account auto-banned.`
      );

      try {
        await admin.auth().revokeRefreshTokens(uid);
      } catch (error: unknown) {
        console.error(
          `onUserCreated: failed to revoke tokens for uid=${uid}`,
          error
        );
      }

      return;
    }

    await db.doc(`users/${uid}`).update({
      ...getServerManagedUserDefaults(age, false),
    });

    console.log(`onUserCreated: uid=${uid} age=${age} written successfully.`);
  }
);

/**
 * Calculates complete years between a birth date and today.
 * Does not round; a person born today is 0 years old.
 */
function calculateAgeInYears(dateOfBirth: Date): number {
  const today = new Date();

  let age = today.getFullYear() - dateOfBirth.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}
