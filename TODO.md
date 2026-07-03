# CODEX PROMPT — Phase 0 Scaffold (Tasks 01–03)

- Paste this entire prompt into Codex in Cursor to begin the project.
- Do NOT execute until you have completed the Firebase Pre-flight steps in TASKS.md.

**Step D — Get Web Config (for Firebase JS SDK)**
- Project Settings → General → Your apps → Add web app → Copy the `firebaseConfig` object
- Store it somewhere safe (not in code yet — Task 06 handles this)":

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyALzYUdA3PY_K7STV3PFOLlGsUBeBhX-7s",
  authDomain: "gym-dating-dev.firebaseapp.com",
  databaseURL: "https://gym-dating-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gym-dating-dev",
  storageBucket: "gym-dating-dev.firebasestorage.app",
  messagingSenderId: "950378069532",
  appId: "1:950378069532:web:e905370591e3c59a0ae9d9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

-----------------------------------------------------------------------------------------brew ----------------------------

# 29 April 2026
1. Maybe prompt with CODEX_PROMPT_PHASE0.md 

# 4 MAY 2026, (done)
**Before Task 09 (auth screens), you must:**
1. Copy `.env.example` → `.env` in your project root
2. Fill in all 7 values from Firebase Console → Project Settings → Your Apps → Web App
3. Add `GoogleService-Info.plist` (iOS) to the project root
4. Add `google-services.json` (Android) to the project root

Task 08 (navigation shell) does not require Firebase to be live yet — you can proceed to Task 08 immediately after Task 07.

# 5 MAY 2026
1. TASK 09 

# 19 MAY 2026
1. One important follow-up: the current client RTDB send helpers also increment unread counts, so once client files are in scope, remove that client-side increment to avoid double unread counts.

# 26 MAY 2026 TODO:
1. *STRIPE* Before testing in the emulator, the developer needs to copy functions/.env.example → functions/.env and populate at minimum STRIPE_SECRET_KEY and the 6 price IDs. The webhook secret is only needed once the emulator is forwarded via the Stripe CLI (stripe listen --forward-to ...), which is documented in BUILD.md from Task 49.

2. *APPLE & ANDROID ID* After Codex completes, the manual step you'll need before first production submission: fill in ascAppId and appleTeamId in eas.json, and download google-play-key.json from Google Play Console.

# 22 JUNE 2026
- ON TASK 94:
  That note is for the future admin dashboard web app, not the mobile Expo app. Right now, since the admin dashboard has not been built yet, you do not need to do anything.
  After Task 94 creates the /admin web dashboard, you will either:
  npm --prefix admin run dev
  then open the local admin URL, or open the deployed site:
  https://fitlink-admin.web.app
  Then:
  Sign in with the Google account whose Firebase UID is M1QbV82r0BOJyI9jz4nJhSQzHpC2.
  If it was already signed in before we set the claim, click sign out.
  Sign back in with the same Google account.
  That fresh sign-in gets a new Firebase ID token containing:
  { "admin": true }
  So for now: nothing else needed. The claim is already set and verified.

