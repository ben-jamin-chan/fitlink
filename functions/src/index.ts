import * as admin from "firebase-admin";

// Initialise Firebase Admin SDK once at module load.
// Guard prevents duplicate initialisation across hot reloads.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { onUserCreated } from "./onUserCreated";
export { getDiscoveryStack } from "./getDiscoveryStack";
export { onSwipeCreated } from "./onSwipeCreated";
export { onNewMessage } from "./onNewMessage";
export { unmatchUser } from "./unmatchUser";
export { createStripeCheckout } from "./createStripeCheckout";
export { createCustomerPortalSession } from "./createCustomerPortalSession";
export { stripeWebhook } from "./stripeWebhook";
export { recordSwipe } from "./recordSwipe";
export { rewindSwipe } from "./rewindSwipe";
export { activateBoost } from "./activateBoost";
export { verifyProfilePhoto } from "./verifyProfilePhoto";
export { moderatePhoto } from "./moderatePhoto";
export { checkReportThreshold } from "./checkReportThreshold";
export { onPrimaryPhotoChanged } from "./onPrimaryPhotoChanged";
export { exchangeStravaToken } from "./exchangeStravaToken";
export { syncStravaActivity } from "./syncStravaActivity";
export { onStravaDisconnected } from "./onStravaDisconnected";
export { createCheckin } from "./createCheckin";
export { createEvent } from "./createEvent";
export { rsvpEvent } from "./rsvpEvent";
export { adminAction } from "./adminAction";
export { restoreStripeSubscription } from "./restoreStripeSubscription";
