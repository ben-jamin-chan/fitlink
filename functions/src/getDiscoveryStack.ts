import * as admin from "firebase-admin";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

type FitnessLevel = "beginner" | "intermediate" | "advanced" | "athlete";

interface UserLocation {
  city: string;
  country: string;
  coordinates: admin.firestore.GeoPoint;
}

interface UserPreferences {
  ageRange: { min: number; max: number };
  distanceKm: number;
  genders: string[];
}

interface UserStats {
  likes: number;
  passes: number;
  matches: number;
}

interface UserSubscription {
  tier: "free" | "premium";
  expiresAt?: admin.firestore.Timestamp;
}

interface FirestoreUser {
  uid: string;
  firstName: string;
  age: number;
  gender: string;
  location: UserLocation;
  photos: string[];
  activities: string[];
  fitnessLevel: FitnessLevel;
  workoutFrequency: string;
  dietaryPreference: string;
  fitnessGoals: string[];
  lookingFor: string[];
  preferences: UserPreferences;
  stats: UserStats;
  subscription: UserSubscription;
  verified: boolean;
  paused: boolean;
  banned: boolean;
  lastActive: admin.firestore.Timestamp;
  photoVerified?: boolean;
}

interface DiscoveryCandidate {
  userId: string;
  // TODO: Strip score from the callable response before production launch.
  score: number;
}

interface DiscoveryStackResponse {
  candidates: DiscoveryCandidate[];
}

const QUERY_LIMIT = 100;
const RETURN_LIMIT = 20;
const FITNESS_LEVELS: FitnessLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "athlete",
];

export const getDiscoveryStack = onCall(
  { region: "asia-southeast1" },
  async (request: CallableRequest): Promise<DiscoveryStackResponse> => {
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to fetch discovery stack."
      );
    }

    const callerId = request.auth.uid;
    const db = admin.firestore();

    const callerDoc = await db.collection("users").doc(callerId).get();
    if (!callerDoc.exists) {
      throw new HttpsError("not-found", "Caller profile not found.");
    }

    const caller = toFirestoreUser(callerId, callerDoc.data());
    if (caller === null) {
      throw new HttpsError("failed-precondition", "Caller profile is invalid.");
    }

    if (caller.banned === true) {
      throw new HttpsError("permission-denied", "Account is suspended.");
    }

    const excludedIds = await fetchExcludedIds(db, callerId);
    excludedIds.add(callerId);

    const candidatesSnap = await db
      .collection("users")
      .where("location.city", "==", caller.location.city)
      .where("banned", "==", false)
      .where("paused", "==", false)
      .orderBy("lastActive", "desc")
      .limit(QUERY_LIMIT)
      .get();

    const scored: DiscoveryCandidate[] = [];

    for (const doc of candidatesSnap.docs) {
      const candidateId = doc.id;

      if (excludedIds.has(candidateId)) {
        continue;
      }

      const candidate = toFirestoreUser(candidateId, doc.data());
      if (candidate === null) {
        continue;
      }

      if (!meetsAgeRequirements(caller, candidate)) {
        continue;
      }

      if (!meetsGenderRequirements(caller, candidate)) {
        continue;
      }

      scored.push({
        userId: candidateId,
        score: scoreCandidate(caller, candidate),
      });
    }

    scored.sort((a: DiscoveryCandidate, b: DiscoveryCandidate) => {
      return b.score - a.score;
    });

    return { candidates: scored.slice(0, RETURN_LIMIT) };
  }
);

function scoreCandidate(caller: FirestoreUser, candidate: FirestoreUser): number {
  let score = 0;

  const sharedActivities = caller.activities.filter((activity: string) => {
    return candidate.activities.includes(activity);
  });
  score += sharedActivities.length * 10;

  const callerLevel = FITNESS_LEVELS.indexOf(caller.fitnessLevel);
  const candidateLevel = FITNESS_LEVELS.indexOf(candidate.fitnessLevel);
  if (
    callerLevel !== -1 &&
    candidateLevel !== -1 &&
    Math.abs(callerLevel - candidateLevel) <= 1
  ) {
    score += 5;
  }

  if (caller.workoutFrequency === candidate.workoutFrequency) {
    score += 3;
  }

  const hoursSinceActive =
    (Date.now() - candidate.lastActive.toMillis()) / 3_600_000;
  if (hoursSinceActive < 24) {
    score += 5;
  } else if (hoursSinceActive < 168) {
    score += 2;
  }

  if (candidate.subscription.tier === "premium") {
    score += 3;
  }

  if (candidate.photoVerified === true || candidate.verified === true) {
    score += 2;
  }

  if (
    caller.dietaryPreference === candidate.dietaryPreference &&
    caller.dietaryPreference !== "No preference" &&
    caller.dietaryPreference !== ""
  ) {
    score += 2;
  }

  const lookingForOverlap = caller.lookingFor.some((value: string) => {
    return candidate.lookingFor.includes(value);
  });
  if (lookingForOverlap) {
    score += 3;
  }

  return score;
}

function meetsAgeRequirements(
  caller: FirestoreUser,
  candidate: FirestoreUser
): boolean {
  const callerWantsCandidate =
    candidate.age >= caller.preferences.ageRange.min &&
    candidate.age <= caller.preferences.ageRange.max;

  const candidateWantsCaller =
    caller.age >= candidate.preferences.ageRange.min &&
    caller.age <= candidate.preferences.ageRange.max;

  return callerWantsCandidate && candidateWantsCaller;
}

function meetsGenderRequirements(
  caller: FirestoreUser,
  candidate: FirestoreUser
): boolean {
  const callerGender = caller.gender.toLowerCase();
  const candidateGender = candidate.gender.toLowerCase();

  const candidateWantsCaller = candidate.preferences.genders.some(
    (gender: string) => {
      const normalizedGender = gender.toLowerCase();
      return normalizedGender === "everyone" || normalizedGender === callerGender;
    }
  );

  const callerWantsCandidate = caller.preferences.genders.some(
    (gender: string) => {
      const normalizedGender = gender.toLowerCase();
      return (
        normalizedGender === "everyone" || normalizedGender === candidateGender
      );
    }
  );

  return callerWantsCandidate && candidateWantsCaller;
}

async function fetchExcludedIds(
  db: admin.firestore.Firestore,
  callerId: string
): Promise<Set<string>> {
  const excluded = new Set<string>();

  const [likedSnap, passedSnap, matchesSnap] = await Promise.all([
    db.collection("swipes").doc(callerId).collection("likes").select().get(),
    db.collection("swipes").doc(callerId).collection("passes").select().get(),
    db
      .collection("matches")
      .where("users", "array-contains", callerId)
      .select("users")
      .get(),
  ]);

  likedSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    excluded.add(doc.id);
  });

  passedSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    excluded.add(doc.id);
  });

  matchesSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    const data: Record<string, unknown> = doc.data();
    const matchedUsers = getStringArray(data.users);

    matchedUsers.forEach((uid: string) => {
      if (uid !== callerId) {
        excluded.add(uid);
      }
    });
  });

  try {
    const blockedSnap = await db
      .collection("blocked")
      .doc(callerId)
      .collection("users")
      .select()
      .get();

    blockedSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
      excluded.add(doc.id);
    });
  } catch {
    // Early-phase accounts may not have a blocked users subcollection yet.
  }

  return excluded;
}

function toFirestoreUser(
  documentId: string,
  data: admin.firestore.DocumentData | undefined
): FirestoreUser | null {
  if (data === undefined) {
    return null;
  }

  const raw: Record<string, unknown> = data;
  const location = parseLocation(raw.location);
  const preferences = parsePreferences(raw.preferences);
  const stats = parseStats(raw.stats);
  const subscription = parseSubscription(raw.subscription);

  if (
    location === null ||
    preferences === null ||
    stats === null ||
    subscription === null ||
    !isFitnessLevel(raw.fitnessLevel) ||
    !(raw.lastActive instanceof admin.firestore.Timestamp)
  ) {
    return null;
  }

  const age = getNumber(raw.age);
  const gender = getString(raw.gender);
  const firstName = getString(raw.firstName);
  const workoutFrequency = getString(raw.workoutFrequency);
  const dietaryPreference = getString(raw.dietaryPreference);
  const banned = getBoolean(raw.banned);
  const paused = getBoolean(raw.paused);
  const verified = getBoolean(raw.verified);

  if (
    age === null ||
    gender === null ||
    firstName === null ||
    workoutFrequency === null ||
    dietaryPreference === null ||
    banned === null ||
    paused === null ||
    verified === null
  ) {
    return null;
  }

  return {
    uid: getString(raw.uid) ?? documentId,
    firstName,
    age,
    gender,
    location,
    photos: getStringArray(raw.photos),
    activities: getStringArray(raw.activities),
    fitnessLevel: raw.fitnessLevel,
    workoutFrequency,
    dietaryPreference,
    fitnessGoals: getStringArray(raw.fitnessGoals),
    lookingFor: getStringArray(raw.lookingFor),
    preferences,
    stats,
    subscription,
    verified,
    paused,
    banned,
    lastActive: raw.lastActive,
    photoVerified: getOptionalBoolean(raw.photoVerified),
  };
}

function parseLocation(value: unknown): UserLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const city = getString(value.city);
  const country = getString(value.country);

  if (
    city === null ||
    country === null ||
    !(value.coordinates instanceof admin.firestore.GeoPoint)
  ) {
    return null;
  }

  return {
    city,
    country,
    coordinates: value.coordinates,
  };
}

function parsePreferences(value: unknown): UserPreferences | null {
  if (!isRecord(value) || !isRecord(value.ageRange)) {
    return null;
  }

  const min = getNumber(value.ageRange.min);
  const max = getNumber(value.ageRange.max);
  const distanceKm = getNumber(value.distanceKm);

  if (min === null || max === null || distanceKm === null) {
    return null;
  }

  return {
    ageRange: { min, max },
    distanceKm,
    genders: getStringArray(value.genders),
  };
}

function parseStats(value: unknown): UserStats | null {
  if (!isRecord(value)) {
    return null;
  }

  const likes = getNumber(value.likes);
  const passes = getNumber(value.passes);
  const matches = getNumber(value.matches);

  if (likes === null || passes === null || matches === null) {
    return null;
  }

  return { likes, passes, matches };
}

function parseSubscription(value: unknown): UserSubscription | null {
  if (!isRecord(value)) {
    return null;
  }

  const tier = value.tier;
  if (tier !== "free" && tier !== "premium") {
    return null;
  }

  if (value.expiresAt instanceof admin.firestore.Timestamp) {
    return { tier, expiresAt: value.expiresAt };
  }

  return { tier };
}

function isFitnessLevel(value: unknown): value is FitnessLevel {
  return (
    value === "beginner" ||
    value === "intermediate" ||
    value === "advanced" ||
    value === "athlete"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item: unknown): item is string => {
    return typeof item === "string";
  });
}
