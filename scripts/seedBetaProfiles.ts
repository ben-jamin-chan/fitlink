// One-off operational script. This is not a Cloud Function and is not deployed.
//
// ts-node is installed under functions/, not the repo root. Run from there:
//   cd functions
//   npx ts-node ../scripts/seedBetaProfiles.ts <path-to-avatar-directory>
//
// For live Firebase writes, provide Admin credentials/project context, for example:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//   FIREBASE_PROJECT_ID=gym-dating-dev \
//   FIREBASE_STORAGE_BUCKET=gym-dating-dev.firebasestorage.app \
//   npx ts-node ../scripts/seedBetaProfiles.ts ../assets/seed-profiles

import type * as FirebaseAdmin from '../functions/node_modules/firebase-admin'
import type { SeedProfileDefinition } from './seedBetaProfiles.config'

declare const require: <Module>(id: string) => Module
declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

interface FileSystemModule {
  existsSync: (filePath: string) => boolean
}

interface PathModule {
  extname: (filePath: string) => string
  join: (...paths: string[]) => string
}

interface SeedProfileConfigModule {
  SEED_PROFILES: SeedProfileDefinition[]
}

type SeedRunStatus = 'created' | 'skipped' | 'failed'

interface SeedRunResult {
  firstName: string
  status: SeedRunStatus
  uid?: string
  errorMessage?: string
}

const admin = require<typeof FirebaseAdmin>(
  '../functions/node_modules/firebase-admin'
)
const fs = require<FileSystemModule>('fs')
const path = require<PathModule>('path')
const { SEED_PROFILES } = require<SeedProfileConfigModule>(
  './seedBetaProfiles.config'
)

function getAdminOptions(): FirebaseAdmin.AppOptions | undefined {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET

  if (projectId === undefined && storageBucket === undefined) {
    return undefined
  }

  return {
    ...(projectId !== undefined ? { projectId } : {}),
    ...(storageBucket !== undefined ? { storageBucket } : {}),
  }
}

if (admin.apps.length === 0) {
  admin.initializeApp(getAdminOptions())
}

const db = admin.firestore()
const auth = admin.auth()
const storage = admin.storage()

const KL_COORDINATES = { lat: 3.139, lng: 101.6869 }
const SEED_EMAIL_DOMAIN = 'fitlink-seed.internal'
const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur'
const PROFILE_PHOTO_FILE = '0.jpg'

function getContentType(avatarLocalPath: string): string {
  const extension = path.extname(avatarLocalPath).toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }

  if (extension === '.png') {
    return 'image/png'
  }

  if (extension === '.svg') {
    return 'image/svg+xml'
  }

  throw new Error(`Unsupported avatar file type: ${extension}`)
}

function validateAvatarFiles(avatarDir: string): void {
  for (const def of SEED_PROFILES) {
    const avatarLocalPath = path.join(avatarDir, def.avatarFile)

    if (!fs.existsSync(avatarLocalPath)) {
      throw new Error(
        `Avatar file not found: ${avatarLocalPath}. Ensure all seed-avatar-* image files are present in the supplied directory.`
      )
    }

    getContentType(avatarLocalPath)
  }
}

function computeAge(dateOfBirthISO: string): number {
  const dateOfBirth = new Date(dateOfBirthISO)
  const today = new Date()

  let age = today.getFullYear() - dateOfBirth.getFullYear()

  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate())

  if (!hasHadBirthdayThisYear) {
    age -= 1
  }

  return age
}

function getSeedEmail(firstName: string): string {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const localPart = slug.length > 0 ? slug : 'profile'

  return `seed-${localPart}@${SEED_EMAIL_DOMAIN}`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  return error.code === code
}

async function findExistingSeedUid(firstName: string): Promise<string | null> {
  const snapshot = await db
    .collection('users')
    .where('isSeedAccount', '==', true)
    .where('firstName', '==', firstName)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  return snapshot.docs[0].id
}

async function getOrCreateSeedAuthUser(
  def: SeedProfileDefinition
): Promise<FirebaseAdmin.auth.UserRecord> {
  const email = getSeedEmail(def.firstName)

  try {
    return await auth.createUser({
      email,
      emailVerified: true,
      disabled: false,
      displayName: def.firstName,
    })
  } catch (error: unknown) {
    if (hasErrorCode(error, 'auth/email-already-exists')) {
      return auth.getUserByEmail(email)
    }

    throw error
  }
}

async function uploadAvatar(
  uid: string,
  avatarLocalPath: string
): Promise<string> {
  const bucket = storage.bucket()
  const destination = `users/${uid}/photos/${PROFILE_PHOTO_FILE}`

  await bucket.upload(avatarLocalPath, {
    destination,
    metadata: {
      contentType: getContentType(avatarLocalPath),
      cacheControl: 'public, max-age=31536000',
    },
  })

  const file = bucket.file(destination)
  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${destination}`
}

async function createSeedProfile(
  def: SeedProfileDefinition,
  avatarDir: string
): Promise<SeedRunResult> {
  const existingUid = await findExistingSeedUid(def.firstName)

  if (existingUid !== null) {
    console.log(
      `Skipping ${def.firstName}: seed account already exists (${existingUid})`
    )

    return { firstName: def.firstName, status: 'skipped', uid: existingUid }
  }

  const avatarLocalPath = path.join(avatarDir, def.avatarFile)
  const userRecord = await getOrCreateSeedAuthUser(def)
  const photoUrl = await uploadAvatar(userRecord.uid, avatarLocalPath)
  const age = computeAge(def.dateOfBirth)

  await db.doc(`users/${userRecord.uid}`).set({
    uid: userRecord.uid,
    firstName: def.firstName,
    dateOfBirth: admin.firestore.Timestamp.fromDate(new Date(def.dateOfBirth)),
    age,
    gender: def.gender,
    location: {
      city: def.city,
      country: 'Malaysia',
      coordinates: new admin.firestore.GeoPoint(
        KL_COORDINATES.lat,
        KL_COORDINATES.lng
      ),
    },
    photos: [photoUrl],
    bio: def.bio,
    height: def.height,
    activities: def.activities,
    fitnessLevel: def.fitnessLevel,
    workoutFrequency: def.workoutFrequency,
    dietaryPreference: def.dietaryPreference,
    fitnessGoals: def.fitnessGoals,
    smoking: def.smoking,
    drinking: def.drinking,
    lookingFor: def.lookingFor,
    preferences: {
      ageRange: { min: 21, max: 45 },
      distanceKm: 50,
      genders: ['male', 'female', 'non-binary'],
      lookingFor: def.lookingFor,
    },
    stats: { likes: 0, passes: 0, matches: 0 },
    premium: {
      active: false,
      tier: null,
      subscriptionId: null,
      expiresAt: null,
    },
    photoVerified: false,
    paused: false,
    banned: false,
    language: 'en',
    timezone: DEFAULT_TIMEZONE,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
    isSeedAccount: true,
  })

  console.log(`Created seed profile: ${def.firstName} (${userRecord.uid})`)

  return {
    firstName: def.firstName,
    status: 'created',
    uid: userRecord.uid,
  }
}

function printSummary(results: SeedRunResult[]): void {
  const createdCount = results.filter(
    (result: SeedRunResult): boolean => result.status === 'created'
  ).length
  const skippedCount = results.filter(
    (result: SeedRunResult): boolean => result.status === 'skipped'
  ).length
  const failed = results.filter(
    (result: SeedRunResult): boolean => result.status === 'failed'
  )

  console.log(
    `Seed summary: ${createdCount} created, ${skippedCount} skipped, ${failed.length} failed.`
  )

  if (failed.length > 0) {
    console.error('Failed profiles:')

    for (const result of failed) {
      console.error(`- ${result.firstName}: ${result.errorMessage}`)
    }
  }
}

async function verifyFirebaseAdminContext(): Promise<void> {
  try {
    await db.collection('users').limit(1).get()
  } catch (error: unknown) {
    throw new Error(
      'Firebase Admin SDK is not configured for this shell. Provide Admin credentials and project context, for example:\n' +
        '  cd functions\n' +
        '  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \\\n' +
        '  FIREBASE_PROJECT_ID=gym-dating-dev \\\n' +
        '  FIREBASE_STORAGE_BUCKET=gym-dating-dev.firebasestorage.app \\\n' +
        '  npx ts-node ../scripts/seedBetaProfiles.ts ../assets/seed-profiles\n\n' +
        `Original error: ${getErrorMessage(error)}`
    )
  }
}

async function main(): Promise<void> {
  const avatarDir = process.argv[2]

  if (avatarDir === undefined || avatarDir === '') {
    console.error(
      'Usage (run from functions/, not repo root):\n' +
        '  cd functions\n' +
        '  npx ts-node ../scripts/seedBetaProfiles.ts <path-to-avatar-directory>'
    )
    process.exit(1)
  }

  if (!fs.existsSync(avatarDir)) {
    console.error(`Avatar directory not found: ${avatarDir}`)
    process.exit(1)
  }

  validateAvatarFiles(avatarDir)
  await verifyFirebaseAdminContext()

  const results: SeedRunResult[] = []

  console.log(`Seeding ${SEED_PROFILES.length} beta profiles (Malaysia only)...`)

  for (const def of SEED_PROFILES) {
    try {
      results.push(await createSeedProfile(def, avatarDir))
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error)
      console.error(`Failed seed profile: ${def.firstName}: ${errorMessage}`)
      results.push({
        firstName: def.firstName,
        status: 'failed',
        errorMessage,
      })
    }
  }

  printSummary(results)

  if (
    results.some(
      (result: SeedRunResult): boolean => result.status === 'failed'
    )
  ) {
    process.exit(1)
  }
}

main().catch((error: unknown): void => {
  console.error('Seed script failed:', getErrorMessage(error))
  process.exit(1)
})
