# TASKS.md — [APP_NAME]
# Phase 1 MVP (Months 1–3)

> **How to use this file:**
> - One task at a time in Codex. Never batch multiple tasks in one prompt.
> - Check off each task after Codex completes and you have reviewed the diff.
> - Git commit after every task: `git commit -m "task-XX: <description>"`
> - If Codex drifts or produces unexpected output, bring the diff back to claude.ai Architect for review before proceeding.
> - Tasks are ordered by dependency — do not skip ahead.

---

*DONE* 
## ⚙️ PRE-FLIGHT: Manual Firebase Setup (Do This Before Any Code) 

> These steps cannot be done by Codex — they require your browser and Firebase console. Complete all of them before starting Task 01.
<!-- 
**Step A — Create Firebase Project**
1. Go to https://console.firebase.google.com
2. Click "Add project" → name it `[app-name]-dev` (your dev environment)
3. Disable Google Analytics for now (you can add Mixpanel later)
4. Wait for project creation

**Step B — Enable Firebase Services**
In your new project, enable these services one by one:
- Authentication → Sign-in methods: Enable **Phone**, **Email/Password**, **Google**
- Firestore Database → Create database → Select region: `asia-southeast1` → Start in **test mode** (you'll lock it down in Task 40)
- Realtime Database → Create database → Region: `us-central1` (RTDB doesn't support asia-southeast1 yet) → Test mode
- Storage → Get started → Region: `asia-southeast1` → Test mode

**Step C — Register Your Apps**
- Add an **iOS app**: Bundle ID `com.[yourname].[app-name]` → Download `GoogleService-Info.plist`
- Add an **Android app**: Package name `com.[yourname].[app-name]` → Download `google-services.json`
- Keep both files — you'll add them to the project in Task 06

**Step D — Get Web Config (for Firebase JS SDK)**
- Project Settings → General → Your apps → Add web app → Copy the `firebaseConfig` object
- Store it somewhere safe (not in code yet — Task 06 handles this)

**Step E — Install Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init
```
During `firebase init`, select: Firestore, Functions, Storage, Emulators
- Functions runtime: Node.js 18
- TypeScript: Yes
- Emulators: Auth, Firestore, Functions, Storage, Realtime Database

✅ Pre-flight complete when you have: Firebase project created, all services enabled, both config files downloaded, CLI initialized. -->
*DONE*

---

## 🏗️ PHASE 0: Project Scaffold

### Task 01 — Initialize Expo Project
- **File(s):** Root `/`
- **Action:** Run the following to create the project:
  ```bash
  npx create-expo-app@latest [app-name] --template blank-typescript
  cd [app-name]
  ```
  Then update `tsconfig.json` to enforce strict TypeScript:
  ```json
  {
    "extends": "expo/tsconfig.base",
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```
- **Output:** Expo project boots on iOS and Android simulators with zero TypeScript errors
- **Do not touch:** Nothing — fresh project

---

### Task 02 — Install All Phase 1 Dependencies
- **File(s):** `package.json`
- **Action:** Install the following packages in one command:
  ```bash
  npx expo install \
    @react-navigation/native \
    @react-navigation/stack \
    @react-navigation/bottom-tabs \
    react-native-screens \
    react-native-safe-area-context \
    react-native-gesture-handler \
    react-native-reanimated \
    zustand \
    react-hook-form \
    @hookform/resolvers \
    zod \
    i18next \
    react-i18next \
    firebase \
    expo-image-picker \
    expo-image-manipulator \
    expo-local-authentication \
    expo-notifications \
    expo-haptics \
    @expo/vector-icons \
    @react-native-async-storage/async-storage
  ```
  Then install dev dependencies:
  ```bash
  npm install --save-dev @types/i18next
  ```
- **Output:** All packages installed, no peer dependency conflicts, `npx expo start` still works
- **Do not touch:** `tsconfig.json`

---

### Task 03 — Create Folder Structure and AGENTS.md
- **File(s):** Root `/`
- **Action Part 1 — Create folders** with `.gitkeep` placeholders:
  ```
  app/auth/
  app/onboarding/
  app/discovery/
  app/matches/
  app/chat/
  app/profile/
  app/settings/
  app/navigation/
  components/ui/
  components/profile/
  components/discovery/
  components/chat/
  store/
  services/firebase/
  hooks/
  types/
  constants/
  utils/
  i18n/
  functions/src/
  ```
- **Action Part 2 — Create `AGENTS.md`** in the project root with the following content:

  ```markdown
  # AGENTS.md — [APP_NAME]

  You are Codex, the implementation agent for [APP_NAME] — a fitness dating app
  for Malaysia and SEA built with React Native Expo.

  ## Non-negotiable rules
  - TypeScript strict mode everywhere. Zero `any`. Zero type errors.
  - No inline styles. All styling uses theme tokens from `constants/`.
  - All user-facing strings go through i18next. No hardcoded text.
  - Never write directly to Firestore from the client for: age, match creation, bans, subscriptions. These go through Cloud Functions.
  - Swipe data uses subcollection structure: `/swipes/{userId}/likes/{targetId}` — never flatten.
  - GestureHandlerRootView must remain at the app root in App.tsx.
  - No open Firestore security rules. Every new collection needs rules.

  ## Tech stack
  - React Native + Expo SDK 52+, TypeScript strict
  - React Navigation v6 (Stack + Bottom Tabs)
  - Zustand for state, React Hook Form + Zod for forms
  - Reanimated 3 for all animations (60fps target)
  - Firebase: Auth, Firestore, Realtime DB, Storage, Cloud Functions
  - i18next for i18n (EN, MY, ZH, TA)

  ## File conventions
  - Screens: PascalCase, suffix `Screen` (e.g. `LoginScreen.tsx`)
  - Components: PascalCase (e.g. `SwipeCard.tsx`)
  - Stores: camelCase, suffix `Store` (e.g. `authStore.ts`)
  - Services: camelCase (e.g. `auth.ts`, `firestore.ts`)
  - Types: PascalCase interfaces (e.g. `UserProfile`, `Match`)
  - Constants: SCREAMING_SNAKE for values, camelCase for theme objects

  ## Before touching any file
  Read ARCHITECT.md for full schema, phase plan, and constraints.
  Read CHANGELOG.md for the latest session state.
  ```

- **Output:** All folders exist, AGENTS.md is in project root, folder structure matches ARCHITECT.md exactly
- **Do not touch:** `package.json`, `tsconfig.json`, `App.tsx`

---

### Task 04 — Create TypeScript Types
- **File(s):** `types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`
- **Action:** Define all interfaces based on the Firestore schema in ARCHITECT.md:

  `types/user.ts`:
  - `Gender` enum: `'male' | 'female' | 'non-binary'`
  - `FitnessLevel` enum: `'beginner' | 'intermediate' | 'advanced' | 'athlete'`
  - `LookingFor` enum: `'friends' | 'workout_partners' | 'dating'`
  - `UserPreferences` interface (ageRange, distanceKm, genders)
  - `UserStats` interface (likes, passes, matches)
  - `UserSubscription` interface (tier: `'free' | 'premium'`, expiresAt?)
  - `UserProfile` interface — all fields from ARCHITECT.md user schema including `paused`, `banned`, `expoPushToken?`

  `types/match.ts`:
  - `Match` interface (users, createdAt, lastMessage?, lastMessageAt?, unread counts)
  - `MatchWithProfile` interface (extends Match, adds the other user's `UserProfile`)

  `types/message.ts`:
  - `MessageType`: `'text' | 'image' | 'voice'`
  - `Message` interface (senderId, text, type, readBy, createdAt)

  `types/subscription.ts`:
  - `SubscriptionTier`: `'free' | 'premium'`
  - `SubscriptionStatus`: `'active' | 'expired' | 'cancelled'`

- **Constraints:** Use `Timestamp` from `firebase/firestore`. No `any`. Export all as named exports.
- **Output:** All type files compile with zero errors

---

### Task 05 — Set Up Theme System
- **File(s):** `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`, `constants/theme.ts`
- **Action:**

  `colors.ts`:
  ```typescript
  export const colors = {
    primary: '#4CAF50',        // green — like, success
    secondary: '#2196F3',      // blue — super like, verified badge
    danger: '#F44336',         // red — pass, delete, error
    warning: '#FFC107',        // yellow — rewind button
    purple: '#9C27B0',         // info/profile button
    white: '#FFFFFF',
    black: '#000000',
    gray: {
      100: '#F5F5F5',
      200: '#EEEEEE',
      400: '#BDBDBD',
      600: '#757575',
      800: '#424242',
    },
    background: '#FAFAFA',
    surface: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.5)',
  } as const;
  ```

  `spacing.ts`: 4px base unit — xs=4, sm=8, md=16, lg=24, xl=32, xxl=48, xxxl=64

  `typography.ts`: Font sizes xs=12, sm=14, md=16, lg=18, xl=24, xxl=32 + font weights (regular=400, medium=500, semibold=600, bold=700)

  `theme.ts`: Export combined `theme` object containing `colors`, `spacing`, `typography`

- **Output:** Theme importable across all files, zero TypeScript errors
- **Do not touch:** Any other file

---

### Task 06 — Set Up Firebase Config
- **File(s):** `services/firebase/config.ts`, `.env.example`, `.gitignore`
- **Action:**
  - Create `services/firebase/config.ts` that reads config from `process.env` and exports initialised Firebase services: `app`, `auth`, `db` (Firestore), `storage`, `rtdb` (Realtime Database). Use `getApps().length` guard to prevent duplicate initialisation.
  - Create `.env.example` with all required keys (no real values):
    ```
    EXPO_PUBLIC_FIREBASE_API_KEY=
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
    EXPO_PUBLIC_FIREBASE_PROJECT_ID=
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
    EXPO_PUBLIC_FIREBASE_APP_ID=
    EXPO_PUBLIC_FIREBASE_DATABASE_URL=
    ```
  - Ensure `.env` is in `.gitignore`
  - Add a comment in `config.ts` instructing developer to copy `.env.example` → `.env` and fill in real values from Firebase Console
- **Constraints:** All config values from `process.env` only. Never hardcode credentials. Use `EXPO_PUBLIC_` prefix so Expo exposes them to the client bundle.
- **Output:** Firebase services exported, no credentials in code, `.env` gitignored

---

### Task 07 — Set Up i18n
- **File(s):** `i18n/index.ts`, `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`
- **Action:**
  - `i18n/index.ts`: Initialise i18next with `react-i18next`, `initReactI18next`, language detection from device locale, fallback to `en`
  - Seed each JSON file with these namespaced keys in `common`:
    ```json
    {
      "common": {
        "next": "Next",
        "back": "Back",
        "skip": "Skip",
        "save": "Save",
        "cancel": "Cancel",
        "done": "Done",
        "loading": "Loading..."
      },
      "auth": {
        "login": "Log In",
        "signup": "Sign Up",
        "logout": "Log Out",
        "phone": "Phone Number",
        "email": "Email",
        "password": "Password",
        "otpSent": "OTP sent to {{phone}}",
        "verifyOtp": "Verify OTP"
      },
      "onboarding": {
        "step": "Step {{current}} of {{total}}",
        "completeProfile": "Complete Profile"
      },
      "errors": {
        "required": "This field is required",
        "network": "Network error. Please try again.",
        "generic": "Something went wrong."
      },
      "discovery": {
        "noMore": "No more profiles nearby",
        "refresh": "Refresh"
      }
    }
    ```
  - `my.json`, `zh.json`, `ta.json`: Same structure, values are placeholders (same English text) — translations filled in later
- **Output:** `useTranslation()` works in any component, returns strings from JSON

---

### Task 08 — Set Up Navigation Shell
- **File(s):** `App.tsx`, `app/navigation/RootNavigator.tsx`, `app/navigation/AuthNavigator.tsx`, `app/navigation/MainTabNavigator.tsx`
- **Action:**

  `App.tsx` — Wrap entire app in this exact provider order (order matters):
  ```tsx
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  </GestureHandlerRootView>
  ```
  Also in App.tsx: call `i18n/index.ts` init before render, initialise Firebase config import.

  `RootNavigator.tsx`:
  - Reads `isAuthenticated` from `authStore` (create a minimal stub store if not built yet)
  - Renders `AuthNavigator` if not authenticated, `MainTabNavigator` if authenticated

  `AuthNavigator.tsx`:
  - Stack navigator with screens: `Landing`, `PhoneLogin`, `OTPVerify`, `EmailLogin`, `SignUp`
  - Each screen renders a placeholder `<View><Text>ScreenName</Text></View>` for now

  `MainTabNavigator.tsx`:
  - Bottom tabs with 4 tabs: `Discover`, `Matches`, `Profile`, `Settings`
  - Use `@expo/vector-icons` (Ionicons): flame, heart, person, settings-outline
  - Active tab color: `colors.primary`
  - Each tab renders a placeholder screen for now

- **Constraints:** `GestureHandlerRootView` must be the outermost wrapper — never move it. TypeScript navigation types must be defined using `RootStackParamList` and `MainTabParamList`.
- **Output:** App boots, tabs are tappable, no crashes on iOS and Android simulators

---

## 🔐 PHASE 1A: Authentication

### Task 09 — Create Auth Service Layer
- **File(s):** `services/firebase/auth.ts`
- **Action:** Create typed async functions:
  - `signInWithPhone(phoneNumber: string): Promise<ConfirmationResult>`
  - `verifyOTP(confirmationResult: ConfirmationResult, otp: string): Promise<UserCredential>`
  - `signInWithEmail(email: string, password: string): Promise<UserCredential>`
  - `signUpWithEmail(email: string, password: string): Promise<UserCredential>`
  - `signInWithGoogle(): Promise<UserCredential>` (use `expo-auth-session` + `@react-native-google-signin/google-signin`)
  - `signOut(): Promise<void>`
  - `getCurrentUser(): User | null`
  - Define `AppError` type: `{ code: string; message: string }` — wrap all Firebase errors in this
- **Constraints:** No `any`. All Firebase errors caught and rethrown as `AppError`.
- **Output:** Service compiles with zero TypeScript errors

---

### Task 10 — Create Auth Zustand Store
- **File(s):** `store/authStore.ts`
- **Action:**
  - State: `user: FirebaseUser | null`, `isLoading: boolean`, `isAuthenticated: boolean`, `error: string | null`
  - Actions: `setUser`, `setLoading`, `setError`, `clearError`, `logout`
  - On store init: set up `onAuthStateChanged` listener → sets `user` and `isAuthenticated`
  - Persist auth state with `zustand/middleware/persist` + `AsyncStorage`
- **Output:** Store initialises, `onAuthStateChanged` fires correctly, persisted across restarts

---

### Task 11 — Build Landing Screen
- **File(s):** `app/auth/LandingScreen.tsx`, `components/ui/Button.tsx`
- **Action:**
  - `Button.tsx`: Reusable component with `variant` prop (`primary` | `outline` | `ghost`), `onPress`, `label`, `loading` (shows spinner), `disabled`. Uses theme tokens, no inline styles.
  - `LandingScreen.tsx`:
    - App logo placeholder (use app name text in primary color, large, bold)
    - Tagline: "Find Your Fitness Match" (from i18n)
    - "Continue with Phone" → navigate to `PhoneLogin` (primary Button)
    - "Continue with Email" → navigate to `EmailLogin` (outline Button)
    - "Continue with Google" → calls `auth.signInWithGoogle()` (outline Button)
    - "Continue with Apple" → iOS only (`Platform.OS === 'ios'`), outline Button
    - Terms of Service text at bottom with `<Text>` tappable link
- **Constraints:** No inline styles. All text via `useTranslation()`.
- **Output:** Landing screen renders and all buttons are tappable on iOS and Android

---

### Task 12 — Build Phone Auth Screen
- **File(s):** `app/auth/PhoneLoginScreen.tsx`, `components/ui/PhoneInput.tsx`
- **Action:**
  - `PhoneInput.tsx`: Country code picker (default +60 MY), phone number field. Validate with Zod: E.164 format (`/^\+[1-9]\d{1,14}$/`). Show inline error.
  - `PhoneLoginScreen.tsx`:
    - Uses `PhoneInput`, `Button`
    - On submit: calls `auth.signInWithPhone()`, sets `confirmationResult` in local state, navigates to `OTPVerifyScreen` passing `confirmationResult` and `phoneNumber` as params
    - Shows loading state on Button during Firebase call
    - Shows error toast on failure
    - Rate limit UX: track attempt count in local state, disable button with countdown after 5 attempts
- **Output:** User can enter phone number and trigger OTP send

---

### Task 13 — Build OTP Verify Screen
- **File(s):** `app/auth/OTPVerifyScreen.tsx`, `components/ui/OTPInput.tsx`
- **Action:**
  - `OTPInput.tsx`: 6-box OTP input (one digit per box). Auto-advance focus on input. Auto-submit when 6 digits entered. Paste support. Backspace moves to previous box.
  - `OTPVerifyScreen.tsx`:
    - Receives `confirmationResult` and `phoneNumber` from navigation params
    - Shows "Code sent to {phoneNumber}"
    - 60-second resend countdown timer (using `useEffect` + `setInterval`)
    - "Resend Code" button (enabled after countdown)
    - On 6-digit entry: calls `auth.verifyOTP()` → on success: `authStore.setUser()` → navigation handled by `RootNavigator` automatically
    - Error: wrong OTP → show error below input, clear OTP boxes
- **Output:** Full OTP flow works end to end

---

### Task 14 — Build Email Auth Screens
- **File(s):** `app/auth/EmailLoginScreen.tsx`, `app/auth/SignUpScreen.tsx`, `components/ui/Input.tsx`
- **Action:**
  - `Input.tsx`: Reusable input with `label`, `placeholder`, `error`, `secureTextEntry`, `keyboardType`. Theme-styled.
  - `EmailLoginScreen.tsx`: Email + password form, Zod validation, calls `auth.signInWithEmail()`, shows errors inline
  - `SignUpScreen.tsx`: Email + password + confirm password, Zod validation (passwords match, min 8 chars, 1 uppercase, 1 number), calls `auth.signUpWithEmail()`
- **Output:** Email sign in and sign up work, validation is inline, no hardcoded text

---

## 📋 PHASE 1B: Onboarding

### Task 15 — Onboarding Shell and Progress Indicator
- **File(s):** `app/onboarding/OnboardingNavigator.tsx`, `components/ui/ProgressDots.tsx`, `store/onboardingStore.ts`
- **Action:**
  - `onboardingStore.ts`: Zustand store holding all 6 steps of partial profile data. Persist to AsyncStorage so user can resume if they exit.
  - `ProgressDots.tsx`: 6 dots, current step highlighted in `colors.primary`, others in `colors.gray[200]`
  - `OnboardingNavigator.tsx`: Stack navigator for steps 1–6. Each step will be a screen (`Step1Screen` through `Step6Screen`).
- **Output:** Onboarding navigator renders, store initialises, dots render

---

### Task 16 — Onboarding Step 1: Basic Info
- **File(s):** `app/onboarding/Step1Screen.tsx`
- **Action:**
  - Fields: First Name (text input), Date of Birth (date picker — use `@react-native-community/datetimepicker`), Gender (segmented buttons: Male / Female / Non-binary)
  - Validation (Zod): firstName 2–50 chars, DOB confirms 18+ (client-side check only — server validates too), gender required
  - "Next" button disabled until all fields valid
  - Save to `onboardingStore` on Next
- **Output:** Step 1 renders, validates, saves to store

---

### Task 17 — Onboarding Step 2: Photos
- **File(s):** `app/onboarding/Step2Screen.tsx`, `components/ui/PhotoGrid.tsx`
- **Action:**
  - `PhotoGrid.tsx`: 3-column grid, max 6 slots. Tap empty slot → image picker (`expo-image-picker`). Shows selected image. "X" button to remove. First slot marked "Primary". No drag-to-reorder yet (Phase 2 enhancement).
  - Photo compression on select: use `expo-image-manipulator` → resize to 1080px wide, quality 0.8
  - Minimum 2 photos required for Next to enable
  - Photos stored as local URIs in `onboardingStore` — actual upload happens on Step 6 completion
- **Output:** Photo grid works, picker opens, compression runs, minimum enforced

---

### Task 18 — Onboarding Step 3: Fitness Profile
- **File(s):** `app/onboarding/Step3Screen.tsx`, `components/ui/MultiSelect.tsx`, `components/ui/SingleSelect.tsx`
- **Action:**
  - `MultiSelect.tsx`: Chip-style multi-select. Selected chips filled with `colors.primary`. Props: `options: string[]`, `selected: string[]`, `onChange`, `min`, `max`.
  - `SingleSelect.tsx`: Same chip style but single selection.
  - Activities MultiSelect (1–10 required): Gym, Running, Cycling, Swimming, Yoga, Hiking, CrossFit, Boxing, Dancing, Badminton, Football, Basketball, Tennis, Martial Arts, Rock Climbing, Pilates
  - Fitness Level SingleSelect (required): Beginner, Intermediate, Advanced, Athlete
  - Workout Frequency SingleSelect (required): 1-2x/week, 3-4x/week, 5-6x/week, Daily
- **Output:** Step 3 renders, selections save to store

---

### Task 19 — Onboarding Step 4: Lifestyle
- **File(s):** `app/onboarding/Step4Screen.tsx`
- **Action:**
  - Dietary Preference SingleSelect (required): No preference, Vegetarian, Vegan, Pescatarian, Keto, Halal, Paleo, Gluten-free
  - Fitness Goals MultiSelect (1–5): Weight loss, Muscle gain, Maintenance, Athletic performance, General health, Flexibility, Endurance
  - Smoking SingleSelect (required): Yes, No, Occasionally
  - Drinking SingleSelect (required): Yes, No, Socially
  - Reuse `MultiSelect` and `SingleSelect` from Task 18
- **Output:** Step 4 renders, saves to store

---

### Task 20 — Onboarding Step 5: About You
- **File(s):** `app/onboarding/Step5Screen.tsx`, `components/ui/Slider.tsx`
- **Action:**
  - Bio textarea (required, 50–500 chars) with live character counter (gray text, turns red when <20 remaining)
  - `Slider.tsx`: Wraps React Native's `Slider` (or `@react-native-community/slider`) with label display. Props: `min`, `max`, `value`, `onChange`, `formatLabel: (v: number) => string`
  - Height slider (required): 140–220 cm, label shows "175 cm"
  - Religion dropdown (optional): Islam, Buddhism, Christianity, Hinduism, Sikhism, No preference, Prefer not to say. Use a simple `Picker` or modal-based selector.
- **Output:** Step 5 renders, bio counter works, slider shows value

---

### Task 21 — Onboarding Step 6: Preferences + Profile Submit
- **File(s):** `app/onboarding/Step6Screen.tsx`, `services/firebase/firestore.ts`, `services/firebase/storage.ts`
- **Action:**
  - Looking For MultiSelect (1+ required): Friends, Workout Partners, Dating
  - Age Range dual slider (18–60): Use two `Slider` components constrained to not cross each other
  - Distance slider (5–100 km)
  - Gender Preference MultiSelect (1+ required): Men, Women, Everyone
  - "Complete Profile" button:
    1. Validate all fields
    2. Show `LoadingOverlay` (create stub if not built)
    3. Upload photos to `storage.ts`: path `users/{userId}/photos/{index}.jpg` — compress again if needed
    4. Write full profile to `firestore.ts`: `createUserProfile(userId, profileData)` function
    5. Clear `onboardingStore`
    6. `authStore` navigation takes user to main app automatically
  - `firestore.ts`: `createUserProfile(uid, data): Promise<void>` — writes to `/users/{uid}`, sets `paused: false`, `banned: false`, `verified: false`, `createdAt`, `lastActive` as server timestamps
  - `storage.ts`: `uploadProfilePhoto(uid, index, uri): Promise<string>` — returns download URL
- **Constraints:** Server timestamps only via `serverTimestamp()`. Never set createdAt from client Date.
- **Output:** Full onboarding flow completes, profile appears in Firestore console

---

## 🔍 PHASE 1C: Discovery

### Task 22 — Cloud Function: onUserCreated
- **File(s):** `functions/src/onUserCreated.ts`, `functions/package.json`
- **Action:**
  - Set up `functions/package.json` for Node.js 18, TypeScript, 2nd gen functions
  - Trigger: `auth.user().onCreate()`
  - Logic: Read `dateOfBirth` from newly created Firestore user doc. Calculate `age = today - dob in years`. Update `/users/{uid}` with `{ age: calculatedAge }`. If user is under 18, set `banned: true` and `bio: 'UNDERAGE_BLOCKED'`.
  - Export as 2nd gen function: `region('asia-southeast1')`
- **Output:** Function deploys to Firebase emulator, age is written on user creation

---

### Task 23 — Cloud Function: getDiscoveryStack
- **File(s):** `functions/src/getDiscoveryStack.ts`
- **Action:** HTTP callable function (2nd gen) that:
  1. Authenticates caller (throws if not authenticated)
  2. Reads calling user's profile from Firestore
  3. Queries `/users` filtered by: same city, not banned, not paused, within age range, matching gender preference
  4. Excludes: users already liked, already passed, already matched, blocked users
  5. Scores each candidate using the algorithm in PRD.md Section 5.3
  6. Returns top 20 user IDs sorted by score descending
  - Use Firestore composite index: `(location.city, banned, paused, lastActive)` — this must match `firestore.indexes.json` (Task 41)
- **Output:** Function returns scored array, deployable to emulator

---

### Task 24 — Cloud Function: onSwipeCreated
- **File(s):** `functions/src/onSwipeCreated.ts`
- **Action:** Firestore trigger on `/swipes/{userId}/likes/{targetId}`.onCreate:
  1. Check if `/swipes/{targetId}/likes/{userId}` exists (mutual like)
  2. If mutual: create `/matches/{matchId}` where `matchId = [userId, targetId].sort().join('_')`
  3. Set match doc with `users`, `createdAt` (serverTimestamp), `lastMessage: null`, `lastMessageAt: null`, `{userId}_unread: 0`, `{targetId}_unread: 0`
  4. Increment `stats.matches` on both user docs
  5. Call `sendMatchNotifications()` helper (stub for now — Task 34 implements push)
- **Output:** Mutual like creates a match doc in Firestore emulator

---

### Task 25 — Discovery Store
- **File(s):** `store/discoveryStore.ts`
- **Action:**
  - State: `stack: UserProfile[]`, `currentIndex: number`, `isLoading: boolean`, `error: string | null`, `dailyLikesCount: number`
  - Actions:
    - `fetchStack()` — calls `getDiscoveryStack` Cloud Function, sets `stack`
    - `swipeRight(targetId)` — writes to `/swipes/{userId}/likes/{targetId}`, increments `dailyLikesCount`, checks daily limit first
    - `swipeLeft(targetId)` — writes to `/swipes/{userId}/passes/{targetId}`
    - `swipeSuperLike(targetId)` — checks premium tier, writes super like
    - `checkDailyLimit()` — reads `users/{userId}/dailyLikes`, returns remaining count
  - Auto-fetch when `stack.length < 3`
- **Output:** Store manages swipe state correctly

---

### Task 26 — Swipe Card Component
- **File(s):** `components/discovery/SwipeCard.tsx`
- **Action:** Animated card using Reanimated 3:
  - `useSharedValue` for x, y position and rotation
  - `useAnimatedGestureHandler` for pan gesture ← ⚠️ SEE CONVENTIONS.md SECTION 11 — use Gesture.Pan() instead
  - `useAnimatedStyle` for transform (translateX, translateY, rotate)
  - When drag > 100px right: trigger like (call `runOnJS(onSwipeRight)`)
  - When drag < -100px left: trigger pass (call `runOnJS(onSwipeLeft)`)
  - When drag > 100px up: trigger super like (call `runOnJS(onSuperLike)`)
  - Rotation: -15° to +15° based on x drag
  - "LIKE" label (green) fades in on right drag, "NOPE" label (red) fades in on left drag, "SUPER" (blue) fades in on up drag
  - Exit animation: card flies off screen in swipe direction (300ms spring)
  - Card content: primary photo (full background), name + age (bottom left), distance (bottom left), activity badges (first 2 as chips), fitness level badge, verified checkmark if `verified: true`
  - Gradient overlay (bottom 40% of card) for text readability
  - Photo pagination dots if user has multiple photos
- **Constraints:** 60fps requirement. Use `runOnJS` only for state updates — no JS logic in worklets.
- **Output:** Card swipes smoothly at 60fps on simulator

---

### Task 27 — Discovery Screen
- **File(s):** `app/discovery/DiscoveryScreen.tsx`, `components/discovery/ActionButtons.tsx`
- **Action:**
  - `ActionButtons.tsx`: Row with 5 buttons: Rewind (yellow, premium), Pass (red X), Super Like (blue star), Like (green heart), Info (purple i). Each has haptic feedback (`expo-haptics`).
  - `DiscoveryScreen.tsx`:
    - Renders top 3 cards from `discoveryStore.stack` in z-order (top card on top)
    - Second card slightly scaled (0.95) and slightly behind
    - Third card scaled 0.90
    - ActionButtons wired to `discoveryStore` actions
    - Empty state when stack is empty (illustration placeholder, "No more profiles" text, Refresh button)
    - Daily limit reached → show upsell modal (stub for now)
    - Loading state while fetching stack
- **Output:** Discovery screen renders cards, swipe actions work, stack refetches automatically

---

### Task 28 — Full Profile Modal
- **File(s):** `components/discovery/FullProfileModal.tsx`
- **Action:**
  - Modal slides up from bottom (full screen)
  - Sections (scrollable): Photo carousel (full width, pagination dots), Name + Age + Location + Verified badge + Active status, Bio (expandable if >200 chars), Fitness Profile card (activities highlighted if shared with viewer, fitness level, frequency, goals), Lifestyle card (diet, smoking, drinking), About card (height, religion if set), "What You Have in Common" section (shared activities listed)
  - Fixed bottom bar: Pass, Like, Super Like buttons
  - Top right: Report button (flag icon)
  - Top left: Close button (X)
  - Dismiss: swipe down or tap close
  - Photo fullscreen: tap photo → modal within modal, pinch-to-zoom
- **Output:** Modal renders all profile data, actions work same as swipe card

---

## 💬 PHASE 1D: Matches & Chat

### Task 29 — Match Store
- **File(s):** `store/matchStore.ts`
- **Action:**
  - State: `matches: MatchWithProfile[]`, `isLoading: boolean`, `newMatchIds: string[]`
  - Actions:
    - `subscribeToMatches(userId)` — Firestore real-time listener on `/matches` where `users` array-contains `userId`. Sorts by `lastMessageAt` desc.
    - `unsubscribeFromMatches()` — cleans up listener
    - `unmatch(matchId)` — deletes match document
    - `markAsRead(matchId)` — resets `{userId}_unread` to 0
  - For each match, fetch the other user's profile to build `MatchWithProfile`
- **Output:** Store subscribes to matches in real-time

---

### Task 30 — Matches Screen
- **File(s):** `app/matches/MatchesScreen.tsx`, `components/chat/MatchCard.tsx`, `components/chat/MessageListItem.tsx`
- **Action:**
  - Top tab navigator (2 tabs): "Matches" and "Messages" (use `@react-navigation/material-top-tabs` or custom tab buttons)
  - **Matches tab**: 3-column grid using `MatchCard.tsx`:
    - Primary photo (3:4 ratio), name overlay, "NEW" badge (green) if no messages, unread count badge (red), online indicator (green dot if active < 5 min)
    - Tap → navigate to `ChatScreen` with `matchId`
    - Long press → action sheet: View Profile, Unmatch, Report
  - **Messages tab**: FlatList sorted by `lastMessageAt` desc using `MessageListItem.tsx`:
    - Circular photo (60x60), name (bold), last message preview (gray, 2 lines), timestamp (formatted relative), unread badge
    - Swipe left → "Unmatch" destructive action
    - Tap → navigate to `ChatScreen`
  - Empty states for both tabs
  - Real-time: powered by `matchStore.subscribeToMatches()`
- **Output:** Matches and messages views work, navigate to chat correctly

---

### Task 31 — Chat Store
- **File(s):** `store/chatStore.ts`, `services/firebase/realtime.ts`
- **Action:**
  - `realtime.ts`:
    - `subscribeToMessages(matchId, callback)` — RTDB listener on `/chats/{matchId}/messages`, ordered by `createdAt`
    - `sendMessage(matchId, senderId, text)` — push to RTDB, also update Firestore match doc `lastMessage` and `lastMessageAt`
    - `unsubscribeFromMessages(matchId)` — removes listener
  - `chatStore.ts`:
    - State: `messages: Message[]`, `isLoading: boolean`, `activMatchId: string | null`
    - Actions: `subscribeToChat(matchId)`, `unsubscribeFromChat()`, `sendMessage(text)`, `sendImage(uri)`
    - Offline queue: if send fails, store in AsyncStorage queue, retry on reconnect (`AppState` listener)
- **Output:** Real-time messages work via RTDB

---

### Task 32 — Chat Screen
- **File(s):** `app/chat/ChatScreen.tsx`, `components/chat/MessageBubble.tsx`, `components/chat/ChatInput.tsx`
- **Action:**
  - `MessageBubble.tsx`: Sent messages (right-aligned, primary color bg, white text), received (left-aligned, gray bg, dark text). Shows timestamp below. "Read" indicator (double checkmark) on sent messages if in `readBy`.
  - `ChatInput.tsx`: Text input (flex grow), send button (right). Disabled if empty. Keyboard avoiding.
  - `ChatScreen.tsx`:
    - Header: back button, other user's photo (circular 40px, tappable → profile), name, online status, menu (3 dots) → View Profile / Unmatch / Report
    - `FlatList` inverted (newest at bottom), powered by `chatStore`
    - `ChatInput` at bottom
    - Shows icebreaker suggestion if no messages yet (from `matchStore` shared activities)
    - Image send: image picker → compress → upload to Storage → send URL as `type: 'image'` message
    - Marks messages as read via `updateDoc` on `readBy` when screen is active
- **Output:** Chat sends and receives in real time

---

### Task 33 — Cloud Function: onNewMessage
- **File(s):** `functions/src/onNewMessage.ts`
- **Action:** RTDB trigger on `/chats/{matchId}/messages/{messageId}`.onCreate:
  1. Get match doc from Firestore to find the other user's ID
  2. Get other user's `expoPushToken` from Firestore
  3. If token exists, send push via Expo Push API:
     - Title: "New message from {senderName}"
     - Body: message text (truncated to 100 chars) or "Sent a photo 📷"
     - Data: `{ type: 'message', matchId }`
  4. Increment `{recipientId}_unread` on match doc
- **Output:** Push notification sent on new message (test with Expo push tool)

---

### Task 34 — Match Celebration Modal
- **File(s):** `components/discovery/MatchCelebrationModal.tsx`
- **Action:**
  - Triggered when `matchStore` detects a new match ID in `newMatchIds`
  - Animation: modal slides up (spring), both photos zoom in with pulse
  - Install `react-native-confetti-cannon` — confetti from top
  - Content: "It's a Match!" headline, both circular photos (120px) side by side, names, shared activity badges
  - Buttons: "Send Message" (navigate to chat, pre-fill icebreaker) and "Keep Swiping" (dismiss)
  - After dismiss, remove from `newMatchIds`
- **Output:** Celebration appears automatically when match is created

---

## 👤 PHASE 1E: Profile & Settings

### Task 35 — Profile Store
- **File(s):** `store/profileStore.ts`
- **Action:**
  - State: `profile: UserProfile | null`, `isLoading: boolean`
  - Actions:
    - `fetchProfile(userId)` — reads `/users/{userId}` from Firestore
    - `updateProfile(partial: Partial<UserProfile>)` — `updateDoc` with partial data
    - `uploadPhoto(uri, index)` — compress + upload + get URL + update photos array
    - `deletePhoto(index)` — remove URL from photos array, delete from Storage
  - Fetch own profile on auth state change
- **Output:** Profile reads and writes work

---

### Task 36 — Profile Screen
- **File(s):** `app/profile/ProfileScreen.tsx`
- **Action:**
  - Own profile view (read-only display of all profile data in same sections as Full Profile Modal)
  - Photo grid at top (tap → go to EditProfileScreen with photos section open)
  - "Edit Profile" button → navigate to `EditProfileScreen`
  - Stats row: Likes received, Matches
  - Verified badge (blue checkmark) if `profile.verified === true`
- **Output:** Profile screen shows logged-in user's full data

---

### Task 37 — Edit Profile Screen
- **File(s):** `app/profile/EditProfileScreen.tsx`
- **Action:**
  - Pre-filled form using React Hook Form + Zod with current `profileStore.profile` data
  - Editable sections: Bio, Height, Activities, Fitness Level, Goals, Diet, Smoking, Drinking, Religion
  - Photo management (same `PhotoGrid` component from onboarding)
  - "Save Changes" → validates → `profileStore.updateProfile()` → success toast
  - Unsaved changes warning if user navigates away (use `navigation.addListener('beforeRemove')`)
- **Output:** Edit and save profile changes, reflected immediately in Profile Screen

---

### Task 38 — Settings Screen
- **File(s):** `app/settings/SettingsScreen.tsx`
- **Action:** Sections:
  - **Account**: Edit Profile (navigate), Change Phone (placeholder)
  - **Discovery**: Age Range slider, Distance slider, Gender Preference — all editable inline, save on change to `profileStore.updateProfile()`
  - **Notifications**: Toggle types (matches, messages) — store preference in AsyncStorage
  - **Privacy**: "Pause Profile" toggle (sets `paused: true/false` in Firestore) — when paused, user is hidden from discovery
  - **Subscription**: "Upgrade to Premium" banner (placeholder — Phase 2)
  - **Support**: FAQ (external link), Contact Us (mailto:)
  - **Legal**: Terms of Service, Privacy Policy (external links)
  - **Danger Zone**: Logout (red) — calls `auth.signOut()` + clears all stores; Delete Account (red) — confirmation dialog → delete all Firestore data + Storage photos + Auth account
- **Output:** All sections functional, logout and delete account work

---

## 🔒 PHASE 1F: Security & Finalization

### Task 39 — Firestore Security Rules
- **File(s):** `firestore.rules`
- **Action:** Write rules for all collections:
  ```
  /users/{userId}
    - read: if request.auth != null (any authenticated user can read profiles for discovery)
    - write: only if request.auth.uid == userId AND not modifying banned/verified/age (server-only fields)

  /swipes/{userId}/likes/{targetId}
    - create: only if request.auth.uid == userId
    - read: only if request.auth.uid == userId OR request.auth.uid == targetId
    - update/delete: deny

  /swipes/{userId}/passes/{targetId}
    - create: only if request.auth.uid == userId
    - read: only if request.auth.uid == userId
    - update/delete: deny

  /matches/{matchId}
    - read: only if request.auth.uid in resource.data.users
    - write: deny (Cloud Function only)

  /matches/{matchId}/messages/{messageId}
    - read: only if request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.users
    - create: only if request.auth.uid in (same users check) AND request.auth.uid == request.resource.data.senderId
    - update/delete: deny

  /reports/{reportId}
    - create: only if request.auth.uid == request.resource.data.reporterId
    - read/update/delete: deny

  default: deny all
  ```
- **Output:** `firestore.rules` file ready to deploy, no open rules

---

### Task 40 — Firestore Indexes
- **File(s):** `firestore.indexes.json`
- **Action:** Define composite indexes:
  - `users`: (`location.city` ASC, `banned` ASC, `paused` ASC, `lastActive` DESC)
  - `matches`: (`users` ARRAY_CONTAINS, `lastMessageAt` DESC)
  - `swipes/{userId}/likes`: (`swiperId` ASC, `createdAt` DESC)
- **Output:** `firestore.indexes.json` ready to deploy

---

### Task 41 — UI Polish: Loading States and Error Boundaries
- **File(s):** `components/ui/LoadingOverlay.tsx`, `components/ui/ErrorBoundary.tsx`, `components/ui/Toast.tsx`
- **Action:**
  - `LoadingOverlay.tsx`: Full-screen semi-transparent overlay with spinner. Props: `visible: boolean`, `message?: string`
  - `ErrorBoundary.tsx`: React class component extending `Component`. Catches render errors. Shows friendly error screen with "Restart App" button. Logs to console (Crashlytics stub until Phase 2).
  - `Toast.tsx`: Lightweight toast (success, error, info variants). Auto-dismiss 3s. Positioned top of screen below status bar. Singleton pattern (only 1 at a time). Expose `showToast(message, type)` via a global ref or Zustand.
  - Wrap app root in `ErrorBoundary` inside `App.tsx`
- **Output:** App handles errors gracefully, no white screens on crash

---

### Task 42 — Push Notification Registration
- **File(s):** `services/notifications.ts`, `hooks/useNotifications.ts`
- **Action:**
  - `notifications.ts`: `registerForPushNotifications()` — requests permission (`expo-notifications`), gets Expo push token, saves to `users/{userId}.expoPushToken` in Firestore
  - `useNotifications.ts`: Hook — calls registration on mount, handles `addNotificationReceivedListener` (show in-app toast), handles `addNotificationResponseReceivedListener` (deep link: match notification → MatchesScreen, message notification → ChatScreen with matchId)
  - Call `useNotifications()` in `App.tsx`
- **Output:** Push token saved to Firestore, notification deep links work

---

### Task 43 — Biometric Auth
- **File(s):** `hooks/useBiometric.ts`, `app/auth/BiometricPrompt.tsx`
- **Action:**
  - `useBiometric.ts`: Check device biometric support (`expo-local-authentication`), read/write biometric preference from AsyncStorage
  - After successful first login: prompt "Enable Face ID / Touch ID?" modal
  - On subsequent cold opens: if enabled, show biometric prompt in `RootNavigator` before showing main app
  - Skip silently if device doesn't support it
- **Output:** Biometric prompt appears on supported devices

---

### Task 44 — Daily Like Limit Enforcement
- **File(s):** `store/discoveryStore.ts` (update), `services/firebase/firestore.ts` (update)
- **Action:**
  - `firestore.ts`: Add `getDailyLikesCount(userId): Promise<{count: number, remaining: number}>` and `incrementDailyLikes(userId): Promise<void>` with reset logic (if `resetAt` is before today midnight, reset count to 0 first)
  - `discoveryStore.swipeRight()`: Call `getDailyLikesCount` before writing like. If count ≥ 50 and user tier is `free`: dispatch `showUpsellModal` action instead of writing swipe.
  - Upsell modal: simple modal with "You're Out of Likes", premium benefits list, "Upgrade Now" CTA (placeholder for Phase 2), "Maybe Later" dismiss
- **Output:** Free users blocked at 50 likes/day, reset at midnight

---

### Task 45 — lastActive Heartbeat
- **File(s):** `hooks/useLastActive.ts`
- **Action:**
  - `AppState` listener: update `users/{userId}.lastActive` to `serverTimestamp()` on app foreground
  - Interval: update every 5 minutes while app is in foreground
  - On background: one final update
  - Use `updateDoc` not `setDoc` to avoid overwriting other fields
- **Output:** `lastActive` stays current for online status display

---

### Task 46 — Final App Wiring Audit
- **File(s):** `App.tsx`, check all files
- **Action:** Audit and confirm:
  - `App.tsx` has correct provider order: `GestureHandlerRootView` → `SafeAreaProvider` → `NavigationContainer` → `RootNavigator`
  - i18n initialised before first render
  - Firebase config imported at top level
  - `useNotifications()` called at root
  - `useLastActive()` called at root
  - `ErrorBoundary` wraps root
  - No hardcoded strings anywhere (audit with grep for obvious literals)
  - No TypeScript `any` (run `tsc --noEmit`)
  - Splash screen hidden after Firebase init completes
- **Output:** Clean app boot, zero TypeScript errors, zero hardcoded strings

---

## ✅ PHASE 1 DONE CHECKLIST

Before declaring MVP ready for beta:

- [ ] Phone OTP sign up works end to end
- [ ] 6-step onboarding completes, profile in Firestore
- [ ] Discovery stack loads and swipe animations are 60fps
- [ ] Mutual likes create a match (Cloud Function in emulator)
- [ ] Match celebration modal appears and animates
- [ ] Matches screen shows grid and message list, real-time updates
- [ ] Chat: send/receive messages in real time via RTDB
- [ ] Push notifications delivered on new match and message
- [ ] Profile view and edit work
- [ ] Settings: pause profile, logout, delete account work
- [ ] Firestore rules deployed — no open rules
- [ ] Daily like limit enforced for free users
- [ ] TypeScript: `tsc --noEmit` passes with zero errors
- [ ] Zero `any` usage
- [ ] All strings through i18next — no hardcoded text
- [ ] App does not crash on any above flows
- [ ] Git history: one commit per task with descriptive messages

---

*TASKS.md — [APP_NAME] Phase 1 | April 2026*
*Generate TASKS_PHASE2.md after Phase 1 ships*
