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

---------------------------------------------------------------------------------------------------------------------

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

