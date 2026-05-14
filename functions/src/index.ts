import * as admin from "firebase-admin";

// Initialise Firebase Admin SDK once at module load.
// Guard prevents duplicate initialisation across hot reloads.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { onUserCreated } from "./onUserCreated";
