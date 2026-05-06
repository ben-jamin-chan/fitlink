# CODEX PROMPT — Tasks 06 & 07
# Firebase Config + i18n Setup

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.1 complete. The following now exist:
- `@/` path alias configured in `tsconfig.json` and `babel.config.js`
- `types/` — user, match, message, subscription interfaces
- `constants/` — colors, spacing, typography, theme re-export
- Node.js v20 LTS confirmed, `npx expo start` boots cleanly

Next: establish the two foundational service layers that every subsequent screen depends on — Firebase initialisation and i18n. Do both tasks in order. Do not proceed to Task 08 in this session.

---

## Task 06 — Firebase Config

**Files to create:**
- `services/firebase/config.ts`
- `.env.example`

**Files to modify:**
- `.gitignore`

---

### `services/firebase/config.ts`

Create the Firebase initialisation file. All config values come from `process.env` only — no hardcoded credentials ever.

```typescript
import { getApps, initializeApp, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'
import { getDatabase, Database } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
}

// Guard against duplicate initialisation (hot reload safe)
const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp()

export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
export const rtdb: Database = getDatabase(app)
export { app }
```

Add a comment block at the top of the file:
```
/**
 * Firebase configuration — initialised once, exported for use across services.
 *
 * Setup:
 * 1. Copy .env.example to .env in the project root
 * 2. Fill in values from Firebase Console → Project Settings → Your Apps → Web App
 * 3. Never commit .env — it is in .gitignore
 *
 * Named exports: auth, db, storage, rtdb, app
 */
```

---

### `.env.example`

Create this file in the project root with empty values:

```
# Firebase Configuration
# Copy this file to .env and fill in your values from Firebase Console
# Project Settings → General → Your apps → Web app → SDK setup and configuration

EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=
```

---

### `.gitignore`

Ensure these lines exist (add if missing, do not remove anything):
```
.env
*.env.local
*.env.production
GoogleService-Info.plist
google-services.json
```

---

**Constraints:**
- All env vars prefixed `EXPO_PUBLIC_` — required for Expo to expose them to the client bundle
- `getApps().length === 0` guard is mandatory — prevents duplicate init on hot reload
- Export named constants only (`auth`, `db`, `storage`, `rtdb`, `app`) — no default export
- Do not create a `.env` file — only `.env.example`
- Zero TypeScript errors

**Acceptance criteria:**
- `services/firebase/config.ts` compiles with zero TypeScript errors
- `.env.example` exists with all 7 keys, all empty
- `.env` is listed in `.gitignore`
- `GoogleService-Info.plist` and `google-services.json` are listed in `.gitignore`
- `tsc --noEmit` still passes

**Do not touch:** `types/`, `constants/`, `App.tsx`, `babel.config.js`, `tsconfig.json`

**Commit:** `git commit -m "task-06: firebase config setup"`

---

## Task 07 — i18n Setup

**Files to create:**
- `i18n/index.ts`
- `i18n/en.json`
- `i18n/my.json`
- `i18n/zh.json`
- `i18n/ta.json`

---

### `i18n/index.ts`

Initialise i18next with react-i18next. Language detection from device locale, fallback to English.

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'

import en from '@/i18n/en.json'
import my from '@/i18n/my.json'
import zh from '@/i18n/zh.json'
import ta from '@/i18n/ta.json'

const deviceLocale = getLocales()[0]?.languageCode ?? 'en'

const supportedLanguages = ['en', 'my', 'zh', 'ta']
const detectedLanguage = supportedLanguages.includes(deviceLocale) ? deviceLocale : 'en'

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      my: { translation: my },
      zh: { translation: zh },
      ta: { translation: ta },
    },
    lng: detectedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,   // React already handles XSS
    },
    compatibilityJSON: 'v3',
  })

export default i18n
```

Note: `expo-localization` is already installed from Task 02 via the Expo package set. Import it directly.

---

### `i18n/en.json`

Create the full English translation file with all keys needed for Phase 1:

```json
{
  "common": {
    "next": "Next",
    "back": "Back",
    "skip": "Skip",
    "save": "Save",
    "cancel": "Cancel",
    "done": "Done",
    "loading": "Loading...",
    "retry": "Retry",
    "close": "Close",
    "confirm": "Confirm",
    "delete": "Delete",
    "edit": "Edit",
    "yes": "Yes",
    "no": "No",
    "or": "or"
  },
  "auth": {
    "landing": {
      "tagline": "Find Your Fitness Match",
      "continuePhone": "Continue with Phone",
      "continueEmail": "Continue with Email",
      "continueGoogle": "Continue with Google",
      "continueApple": "Continue with Apple",
      "terms": "By continuing, you agree to our Terms of Service and Privacy Policy"
    },
    "phone": {
      "title": "Enter Your Number",
      "subtitle": "We'll send you a verification code",
      "placeholder": "Phone number",
      "send": "Send Code",
      "countryCode": "Country code"
    },
    "otp": {
      "title": "Enter the Code",
      "subtitle": "Code sent to {{phone}}",
      "resend": "Resend Code",
      "resendIn": "Resend in {{seconds}}s",
      "verify": "Verify"
    },
    "email": {
      "title": "Log In",
      "emailPlaceholder": "Email address",
      "passwordPlaceholder": "Password",
      "login": "Log In",
      "noAccount": "Don't have an account?",
      "signup": "Sign Up"
    },
    "signup": {
      "title": "Create Account",
      "emailPlaceholder": "Email address",
      "passwordPlaceholder": "Password (min 8 characters)",
      "confirmPlaceholder": "Confirm password",
      "create": "Create Account",
      "hasAccount": "Already have an account?",
      "login": "Log In"
    },
    "biometric": {
      "enable": "Enable Face ID / Touch ID?",
      "enableSubtitle": "Log in faster next time",
      "enableButton": "Enable",
      "skipButton": "Not now"
    }
  },
  "onboarding": {
    "step": "Step {{current}} of {{total}}",
    "completeProfile": "Complete Profile",
    "step1": {
      "title": "About You",
      "firstName": "First name",
      "firstNamePlaceholder": "Your first name",
      "dateOfBirth": "Date of birth",
      "gender": "Gender",
      "male": "Male",
      "female": "Female",
      "nonBinary": "Non-binary",
      "location": "Your city"
    },
    "step2": {
      "title": "Your Photos",
      "subtitle": "Add at least 2 photos",
      "primary": "Primary",
      "addPhoto": "Add Photo",
      "guidelines": "Clear face photos work best"
    },
    "step3": {
      "title": "Fitness Profile",
      "activities": "Your Activities",
      "activitiesHelper": "Select 1–10 activities",
      "fitnessLevel": "Fitness Level",
      "workoutFrequency": "Workout Frequency",
      "beginner": "Beginner",
      "intermediate": "Intermediate",
      "advanced": "Advanced",
      "athlete": "Athlete"
    },
    "step4": {
      "title": "Lifestyle",
      "diet": "Dietary Preference",
      "goals": "Fitness Goals",
      "goalsHelper": "Select up to 5",
      "smoking": "Smoking",
      "drinking": "Drinking"
    },
    "step5": {
      "title": "About You",
      "bio": "Your bio",
      "bioPlaceholder": "Tell others about yourself and your fitness journey...",
      "bioCounter": "{{count}} characters remaining",
      "height": "Height",
      "heightLabel": "{{value}} cm",
      "religion": "Religion (optional)"
    },
    "step6": {
      "title": "Your Preferences",
      "lookingFor": "Looking For",
      "ageRange": "Age Range",
      "ageRangeLabel": "{{min}}–{{max}} years",
      "distance": "Distance",
      "distanceLabel": "{{value}} km",
      "genderPreference": "Interested In"
    }
  },
  "discovery": {
    "emptyState": {
      "title": "No More Profiles",
      "subtitle": "Check back later or expand your preferences",
      "refresh": "Refresh"
    },
    "limitReached": {
      "title": "You're Out of Likes",
      "subtitle": "Upgrade to Premium for unlimited likes",
      "upgrade": "Upgrade Now",
      "later": "Maybe Later"
    },
    "labels": {
      "like": "LIKE",
      "nope": "NOPE",
      "super": "SUPER"
    },
    "actions": {
      "rewind": "Rewind",
      "pass": "Pass",
      "superLike": "Super Like",
      "like": "Like",
      "info": "View Profile"
    }
  },
  "matches": {
    "tabs": {
      "matches": "Matches",
      "messages": "Messages"
    },
    "emptyMatches": {
      "title": "No Matches Yet",
      "subtitle": "Keep swiping to find your fitness match!"
    },
    "emptyMessages": {
      "title": "No Messages Yet",
      "subtitle": "Start a conversation with one of your matches"
    },
    "newBadge": "NEW",
    "unmatch": "Unmatch",
    "report": "Report",
    "viewProfile": "View Profile",
    "celebration": {
      "title": "It's a Match!",
      "subtitle": "You and {{name}} liked each other",
      "sendMessage": "Send Message",
      "keepSwiping": "Keep Swiping"
    }
  },
  "chat": {
    "inputPlaceholder": "Type a message...",
    "sentPhoto": "Sent a photo 📷",
    "read": "Read",
    "icebreaker": "You both love {{activity}} — say hi!"
  },
  "profile": {
    "editProfile": "Edit Profile",
    "verified": "Verified",
    "active": "Active now",
    "activeRecently": "Active recently",
    "stats": {
      "likes": "Likes",
      "matches": "Matches"
    },
    "sections": {
      "fitnessProfile": "Fitness Profile",
      "lifestyle": "Lifestyle",
      "about": "About",
      "inCommon": "In Common"
    }
  },
  "settings": {
    "sections": {
      "account": "Account",
      "discovery": "Discovery",
      "notifications": "Notifications",
      "privacy": "Privacy",
      "subscription": "Subscription",
      "support": "Support",
      "legal": "Legal",
      "dangerZone": "Danger Zone"
    },
    "editProfile": "Edit Profile",
    "changePhone": "Change Phone Number",
    "pauseProfile": "Pause Profile",
    "pauseProfileSubtitle": "Hide your profile from discovery",
    "logout": "Log Out",
    "deleteAccount": "Delete Account",
    "deleteAccountConfirm": "Are you sure? This cannot be undone.",
    "upgradePremium": "Upgrade to Premium",
    "faq": "FAQ",
    "contactUs": "Contact Us",
    "terms": "Terms of Service",
    "privacy": "Privacy Policy"
  },
  "errors": {
    "required": "This field is required",
    "network": "Network error. Please try again.",
    "generic": "Something went wrong. Please try again.",
    "auth": {
      "invalidPhone": "Please enter a valid phone number",
      "invalidOtp": "Incorrect code. Please try again.",
      "tooManyAttempts": "Too many attempts. Please wait {{minutes}} minutes.",
      "invalidEmail": "Please enter a valid email address",
      "weakPassword": "Password must be at least 8 characters with 1 uppercase and 1 number",
      "passwordMismatch": "Passwords do not match",
      "userNotFound": "No account found with this email",
      "wrongPassword": "Incorrect password",
      "emailInUse": "An account with this email already exists",
      "underage": "You must be 18 or older to use this app"
    },
    "photo": {
      "permission": "Please allow photo access to add photos",
      "uploadFailed": "Photo upload failed. Please try again.",
      "tooLarge": "Photo is too large. Please choose a smaller image."
    },
    "profile": {
      "bioTooShort": "Bio must be at least 50 characters",
      "bioTooLong": "Bio cannot exceed 500 characters",
      "minPhotos": "Please add at least 2 photos",
      "minActivities": "Please select at least 1 activity"
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`

Create all three files with the **identical structure** as `en.json` but with the same English values as placeholders. Add a comment at the top of each:

`my.json` — add this note at root level: `"_note": "Malay translations — placeholder values, to be replaced by translator"`
`zh.json` — `"_note": "Simplified Chinese translations — placeholder values, to be replaced by translator"`
`ta.json` — `"_note": "Tamil translations — placeholder values, to be replaced by translator"`

All other keys should have the same English string values as `en.json` for now.

---

**Install missing dependency:**

`expo-localization` may not have been installed in Task 02. Check `package.json` — if it's missing, run:
```bash
npx expo install expo-localization
```

---

**Constraints:**
- `i18n/index.ts` must be importable without side effects — it uses `void i18n.init(...)` to suppress the promise
- All keys in `en.json` must exist identically in `my.json`, `zh.json`, and `ta.json` — same structure, same nesting depth
- No hardcoded strings in `i18n/index.ts` itself — all strings live in JSON files
- Zero TypeScript errors

**Acceptance criteria:**
- `i18n/index.ts` imports without errors
- All 4 JSON files exist with matching key structure
- `tsc --noEmit` passes
- `npx expo start` still boots

**Do not touch:** `services/firebase/config.ts`, `types/`, `constants/`, `App.tsx`

**Commit:** `git commit -m "task-07: i18n setup with EN, MY, ZH, TA"`

---

## After This Session

Update `CHANGELOG.md` (in project root — not in `docs/`):

```
## [Phase 1.2] — YYYY-MM-DD
### Completed
- Task 06: Firebase config initialised, .env.example created, secrets gitignored
- Task 07: i18n initialised with expo-localization, 4 language files seeded (EN, MY, ZH, TA)

### Files Created / Modified
- services/firebase/config.ts: Firebase app init with auth, db, storage, rtdb exports
- .env.example: 7 Firebase env var keys, all empty
- .gitignore: added .env, GoogleService-Info.plist, google-services.json
- i18n/index.ts: i18next init with device locale detection
- i18n/en.json: full English translation file for all Phase 1 screens
- i18n/my.json, i18n/zh.json, i18n/ta.json: placeholder translations (same as EN)

### Known Issues / Deferred
- .env not yet populated — developer must copy .env.example → .env and fill in Firebase values before Task 09 (auth screens need live Firebase connection)
- GoogleService-Info.plist and google-services.json not yet added to project — needed for Task 09

### Next Up
- Task 08: Navigation shell (RootNavigator, AuthNavigator, MainTabNavigator, GestureHandlerRootView)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 08 prompt.

---

## Note to Developer

**Before Task 09 (auth screens), you must:**
1. Copy `.env.example` → `.env` in your project root
2. Fill in all 7 values from Firebase Console → Project Settings → Your Apps → Web App
3. Add `GoogleService-Info.plist` (iOS) to the project root
4. Add `google-services.json` (Android) to the project root

Task 08 (navigation shell) does not require Firebase to be live yet — you can proceed to Task 08 immediately after Task 07.
