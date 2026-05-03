# Product Requirements Document: fitlink SEA

**Version:** 1.0  
**Last Updated:** April 2026  
**Product Owner:** Benjamin Chan  
**Target Market:** Malaysia & Southeast Asia  
**Platform:** iOS, Android (React Native Expo)

---

## 1. Executive Summary

### 1.1 Product Vision
fitlink is a fitness-focused dating and social networking app designed specifically for the Malaysia and Southeast Asia market. It connects active individuals who share fitness lifestyles, workout preferences, and wellness goals, filling a market gap left by international apps like Fitafy and TeamUp which are unavailable in the region.

### 1.2 Market Opportunity
- **Target Market:** Malaysia, Singapore, Thailand, Philippines, Indonesia, Vietnam
- **Primary Competitors:** Tinder, Bumble (general dating), but no fitness-specific dating apps in SEA
- **Market Gap:** Fitness enthusiasts in SEA lack a dedicated platform for finding workout partners and romantic connections
- **Revenue Model:** Freemium with premium subscriptions (RM29.90-49.90/month)

### 1.3 Success Metrics
- **Phase 1 (3 months):** 1,000 active users in Kuala Lumpur
- **Phase 2 (6 months):** 10,000 users across Malaysia
- **Phase 3 (12 months):** 50,000 users across SEA
- **Conversion Rate:** 5% free to premium conversion
- **Engagement:** 3+ sessions per week per active user

---

## 2. Product Goals & Objectives

### 2.1 Primary Goals
1. **Connect Fitness Enthusiasts**: Enable users to find romantic partners and workout buddies who share their active lifestyle
2. **Build Trust & Safety**: Implement robust verification and safety features critical for SEA market
3. **Drive Engagement**: Create compelling features that encourage daily usage
4. **Sustainable Revenue**: Build viable freemium business model with local payment integration

### 2.2 Key Differentiators
- **Fitness-First Matching**: Algorithm prioritizes shared activities, fitness levels, and workout schedules
- **Activity Integration**: Connect with Apple Health, Google Fit, Strava to share real workouts
- **SEA Localization**: Multi-language support (English, Malay, Chinese, Tamil), local payment methods (FPX, GrabPay), cultural considerations (religion, halal options)
- **Safety-Focused**: Photo verification, robust reporting, community guidelines tailored for SEA

---

## 3. Target Users

### 3.1 Primary Personas

**Persona 1: Active Professional Amy**
- Age: 25-35
- Location: Kuala Lumpur, Malaysia
- Occupation: Marketing Manager
- Fitness: Gym 4x/week, runs on weekends
- Goal: Find a partner who values health and fitness
- Pain Point: General dating apps don't filter for active lifestyles
- Tech Savvy: High, uses fitness apps daily

**Persona 2: Fitness Enthusiast Fariz**
- Age: 28-38
- Location: Johor Bahru, Malaysia
- Occupation: Software Engineer
- Fitness: CrossFit athlete, meal preps
- Goal: Find workout partners and potential romantic connection
- Pain Point: Friends aren't committed to fitness, hard to find compatible dates
- Tech Savvy: Very high, early adopter

**Persona 3: Wellness-Focused Wei**
- Age: 23-30
- Location: Singapore
- Occupation: Yoga Instructor
- Fitness: Daily yoga, plant-based diet
- Goal: Meet like-minded individuals for friendship and dating
- Pain Point: Values wellness holistically, wants aligned partner
- Tech Savvy: Medium-high

### 3.2 User Demographics
- **Age Range:** 18-45 (primary: 25-35)
- **Gender Split:** 50/50 target (may skew based on fitness activities)
- **Income:** Middle to upper-middle class (premium subscription affordability)
- **Education:** College-educated majority
- **Fitness Level:** All levels welcome (beginner to athlete)

---

## 4. Technical Architecture

### 4.1 Tech Stack

**Frontend:**
- **Framework:** React Native with Expo SDK 52+
- **Language:** TypeScript (strict mode)
- **Navigation:** React Navigation v6 (Stack, Bottom Tabs, Drawer)
- **State Management:** Zustand with persistence
- **Forms:** React Hook Form + Zod validation
- **Styling:** Custom theme system with Tailwind-inspired utilities
- **Animations:** React Native Reanimated 3
- **Internationalization:** i18next

**Backend:**
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth (Phone, Email, Google, Apple)
- **Storage:** Firebase Cloud Storage
- **Real-time:** Firebase Realtime Database (chat)
- **Cloud Functions:** Node.js (2nd gen, asia-southeast1 region)
- **Analytics:** Firebase Analytics + Mixpanel

**Payments:**
- **Provider:** Stripe
- **Supported Methods:** Credit/debit cards, FPX (Malaysia), GrabPay, Touch 'n Go eWallet
- **Currencies:** MYR, SGD, THB, PHP, IDR, VND

**Third-Party Integrations:**
- Apple Health Kit (iOS)
- Google Fit (Android)
- Strava API (OAuth 2.0)
- Google Places API (location autocomplete, gym database)
- Google Cloud Vision API (photo verification)

### 4.2 Infrastructure
- **Region:** Asia-Southeast1 (Singapore) for low latency
- **CDN:** Firebase Hosting for static assets
- **Environment:** Development, Staging, Production
- **CI/CD:** EAS Build (Expo Application Services)

---

## 5. Feature Requirements

## Epic 1: Authentication & Onboarding

### 5.1 User Registration

**Priority:** P0 (Must Have)

**User Story:**
_As a new user, I want to create an account quickly and securely so I can start finding matches._

**Requirements:**

**FR-1.1.1 Authentication Methods**
- Phone number authentication with OTP (6-digit code)
- Email/password authentication (backup method)
- Google Sign-In (OAuth 2.0)
- Apple Sign-In (iOS only, required for App Store)
- Support for +60 (Malaysia) and other SEA country codes

**FR-1.1.2 Phone Verification**
- Send OTP via Firebase Phone Auth
- 60-second resend timer
- Maximum 5 attempts per phone number per hour
- Auto-detect country code from device locale

**FR-1.1.3 Security**
- Password requirements: Minimum 8 characters, 1 uppercase, 1 number
- Biometric authentication option (Face ID/Touch ID) for returning users
- Session management with automatic token refresh
- Rate limiting on login attempts (5 per hour)

**FR-1.1.4 Age Verification**
- Must be 18+ to create account
- Date of birth required during onboarding
- Age calculated on server-side (Cloud Function) to prevent manipulation
- Block account creation if under 18

**Acceptance Criteria:**
- [ ] User can sign up with phone number and receive OTP within 30 seconds
- [ ] User can sign up with email/password with real-time validation
- [ ] Social login works on both iOS and Android
- [ ] Under-18 users are blocked with clear error message
- [ ] Biometric auth can be enabled after initial login

---

### 5.2 Multi-Step Onboarding

**Priority:** P0 (Must Have)

**User Story:**
_As a new user, I want to complete my profile through a guided process so I can start matching with compatible people._

**Requirements:**

**FR-1.2.1 Step 1: Basic Information**
- First name (required, 2-50 characters)
- Date of birth (required, date picker, must be 18+)
- Gender (required): Male, Female, Non-binary
- Location (required): City autocomplete for Malaysia/SEA cities
  * Malaysia: KL, Selangor, Penang, JB, Ipoh, Melaka, Kota Kinabalu, Kuching, Kuantan, Alor Setar
  * Singapore: Central, East, North, South, West
  * Thailand: Bangkok, Chiang Mai, Phuket, Pattaya, Krabi
  * Philippines: Manila, Cebu, Davao, Quezon City
  * Indonesia: Jakarta, Bali, Surabaya, Bandung
  * Vietnam: HCMC, Hanoi, Da Nang

**FR-1.2.2 Step 2: Photos**
- Minimum 2 photos required, maximum 6
- Upload from camera or gallery
- Auto-compress to max 2MB per photo (1080px width, 80% quality)
- Drag to reorder photos
- First photo is primary (shown in discovery)
- Photo guidelines shown: "Clear face photos work best"
- Delete and replace functionality

**FR-1.2.3 Step 3: Fitness Profile**
- Primary activities (multi-select, 1-10 required):
  * Gym, Running, Cycling, Swimming, Yoga, Hiking, CrossFit, Boxing, Dancing
  * Badminton, Football, Basketball, Tennis, Martial Arts, Rock Climbing, Pilates
- Fitness level (required, single select):
  * Beginner, Intermediate, Advanced, Athlete
- Workout frequency (required):
  * 1-2x/week, 3-4x/week, 5-6x/week, Daily

**FR-1.2.4 Step 4: Lifestyle**
- Dietary preference (required):
  * No preference, Vegetarian, Vegan, Pescatarian, Keto, Halal, Paleo, Gluten-free
- Fitness goals (multi-select, 1-5):
  * Weight loss, Muscle gain, Maintenance, Athletic performance, General health, Flexibility, Endurance
- Smoking (required): Yes, No, Occasionally
- Drinking (required): Yes, No, Socially

**FR-1.2.5 Step 5: About You**
- Bio (required, 50-500 characters with live counter)
- Height (required, slider 140-220cm with cm label)
- Religion (optional dropdown):
  * Islam, Buddhism, Christianity, Hinduism, Sikhism, No preference, Prefer not to say

**FR-1.2.6 Step 6: Preferences**
- Looking for (multi-select, at least 1):
  * Friends, Workout partners, Dating
- Age range (required, dual slider 18-60)
- Distance range (required, slider 5-100km)
- Gender preference (multi-select, at least 1):
  * Men, Women, Everyone

**FR-1.2.7 Form Behavior**
- Progress indicator (6 dots, current step highlighted)
- "Next" button disabled until required fields complete
- "Back" button on steps 2-6
- "Skip" option for optional fields
- Form validation with inline error messages
- Auto-save draft to local storage (restore if user exits)
- Final step: "Complete Profile" button

**FR-1.2.8 Data Storage**
- Save to Firestore `/users/{userId}` on completion
- Upload photos to Storage `/users/{userId}/photos/{index}.jpg`
- Calculate age from dateOfBirth (server-side)
- Set default stats: likes=0, passes=0, matches=0
- Set createdAt, lastActive timestamps
- Set language preference from device locale or user selection
- Set `paused: false` (profile visible in discovery by default)
- Set `banned: false`
- Do not set `expoPushToken` here — this is populated by the notification registration hook on first app open

**Acceptance Criteria:**
- [ ] User can complete entire onboarding in under 5 minutes
- [ ] Progress is saved and restorable if user exits
- [ ] All validation works with clear, localized error messages
- [ ] Photos upload successfully and are compressed
- [ ] Profile is created in Firestore with all required fields
- [ ] User is redirected to main app after completion

---

## Epic 2: Discovery & Matching

### 5.3 Discovery Stack Algorithm

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to see potential matches who share my fitness interests and meet my preferences so I can find compatible people._

**Requirements:**

**FR-2.1.1 Matching Algorithm (Cloud Function: `getDiscoveryStack`)**

**Input:**
- Current user ID from authenticated request
- User's location, age, gender, preferences, fitness profile

**Filtering Logic (Priority Order):**
1. **Exclude:**
   - Own profile
   - Users already liked
   - Users already passed
   - Matched users
   - Blocked users
   - Banned users (user.banned === true)
   - Accounts with paused === true

2. **Location Filter:**
   - Must be within user's distance preference
   - Calculate using Firestore GeoPoint and distance formula
   - Priority to same city

3. **Age Filter:**
   - Must fall within user's age range preference
   - Bidirectional: User must also fall within candidate's age range

4. **Gender Filter:**
   - Must match user's gender preference
   - Bidirectional check

**Scoring Algorithm:**
```javascript
score = 0

// Shared fitness activities (highest weight)
sharedActivities = intersection(user.activities, candidate.activities)
score += sharedActivities.length * 10

// Compatible fitness level (±1 level)
levels = ['beginner', 'intermediate', 'advanced', 'athlete']
userLevel = levels.indexOf(user.fitnessLevel)
candidateLevel = levels.indexOf(candidate.fitnessLevel)
if (abs(userLevel - candidateLevel) <= 1) {
  score += 5
}

// Similar workout frequency
if (user.frequency === candidate.frequency) {
  score += 3
}

// Recently active users (boost engagement)
hoursSinceActive = (now - candidate.lastActive) / 3600000
if (hoursSinceActive < 24) {
  score += 5
} else if (hoursSinceActive < 168) { // within week
  score += 2
}

// Premium users (monetization incentive)
if (candidate.premium.active) {
  score += 3
}

// Verified profiles (trust signal)
if (candidate.photoVerified) {
  score += 2
}

// Shared dietary preferences
if (user.diet === candidate.diet && user.diet !== 'No preference') {
  score += 2
}

// Looking for overlap
lookingForOverlap = intersection(user.preferences.lookingFor, candidate.preferences.lookingFor)
if (lookingForOverlap.length > 0) {
  score += 3
}
```

**Output:**
- Return array of 20 user IDs sorted by score (descending)
- Include score for debugging (remove in production)

**Performance:**
- Use Firestore composite index: (location.city, banned, paused, lastActive)
- Query limit: 100 candidates maximum before scoring
- Cache results client-side for 1 hour
- Refresh when stack is empty or on pull-to-refresh

**FR-2.1.2 Discovery Stack Refresh**
- Auto-fetch new stack when current stack has <3 cards remaining
- Pull-to-refresh manually
- Clear cache and fetch new stack
- Show loading indicator during fetch

**Acceptance Criteria:**
- [ ] Algorithm returns diverse, compatible matches
- [ ] Stack fetches within 3 seconds on 4G network
- [ ] Users see at least 10-15 new profiles per day (if available in area)
- [ ] Scoring prioritizes shared fitness activities correctly
- [ ] Bidirectional preference matching works (both users meet each other's criteria)

---

### 5.4 Swipe Interface

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to swipe through potential matches with smooth animations so I can quickly decide who I'm interested in._

**Requirements:**

**FR-2.2.1 Card Stack UI**
- Display user cards in stack (max 3 visible at once)
- Each card shows:
  * Primary photo (full card background)
  * Name, Age (bottom left)
  * Distance (e.g., "3 km away")
  * Verified badge (blue checkmark if photoVerified)
  * Activity badges (first 2 activities as chips)
  * Fitness level badge
  * "Active today" badge (if fitness tracker shows activity in last 24h)
- Gradient overlay at bottom for text readability
- Photo pagination dots (if user has multiple photos)
- Tap card to view full profile modal

**FR-2.2.2 Photo Carousel**
- Swipe/tap left side of card → Previous photo
- Swipe/tap right side of card → Next photo
- Pagination dots indicator
- Smooth transition animation

**FR-2.2.3 Swipe Gestures**
- **Swipe Right (>100px horizontal):** Like
  * Card exits right with rotation
  * Green "LIKE" label appears
  * Haptic success feedback
  
- **Swipe Left (<-100px horizontal):** Pass
  * Card exits left with rotation
  * Red "NOPE" label appears
  * Haptic light feedback

- **Swipe Up (>100px vertical):** Super Like (Premium Feature)
  * Card exits up with scale animation
  * Blue "SUPER LIKE" label appears
  * Star particle effect
  * If free user: Show paywall modal, cancel swipe
  * If premium: Process super like

- **Tap Card:** Open full profile modal
- **Pinch to Zoom:** Zoom into photo

**FR-2.2.4 Animation Specifications**
- Use react-native-reanimated for 60fps performance
- Card drag follows finger with spring physics (damping: 15, stiffness: 150)
- Rotation range: -15° to +15° based on drag direction
- Next card scales from 0.95 to 1.0 as top card exits
- Exit animation duration: 300ms
- Label opacity based on drag distance (0 to 1)

**FR-2.2.5 Action Buttons**
Bottom row with 5 buttons:
1. **Undo (Rewind)** - Premium only
   * Icon: Curved arrow left
   * Color: Yellow
   * Restores last swiped card
   * Shows paywall if free user
   
2. **Pass**
   * Icon: X
   * Color: Red
   * Programmatic swipe left

3. **Super Like**
   * Icon: Star
   * Color: Blue
   * Programmatic swipe up
   * Shows paywall if free user

4. **Like**
   * Icon: Heart
   * Color: Green
   * Programmatic swipe right

5. **Info**
   * Icon: i (info)
   * Color: Purple
   * Opens full profile modal

**FR-2.2.6 Empty State**
When stack is empty:
- Illustration (magnifying glass animation)
- "No more profiles nearby"
- Subtitle: "Check back later or adjust your distance range"
- "Refresh" button (refetch stack)
- "Edit Preferences" button (opens preferences modal)

**FR-2.2.7 Daily Limit (Free Users)**
- Free users: 50 likes per day
- Counter resets at midnight local time
- Track in Firestore: `users/{userId}/dailyLikes`: `{ count: number, resetAt: Timestamp }`
- When limit reached:
  * Show "Out of Likes" modal
  * Display premium upsell
  * Block like/super like actions
  * Allow passes (unlimited)

**FR-2.2.8 Premium Upsell Modal**
Triggered when:
- Free user swipes up (super like)
- Free user reaches 50 likes
- Free user taps rewind button

Modal content:
- Headline: "You're Out of Likes" or "Upgrade to Premium"
- List of premium benefits
- "Upgrade Now" CTA button
- "Maybe Later" dismiss button

**Acceptance Criteria:**
- [ ] Swipe animations are smooth 60fps on mid-range devices
- [ ] All gestures (swipe, tap, pinch) work correctly
- [ ] Daily limit enforces and resets properly
- [ ] Empty state appears when no more profiles
- [ ] Premium features show paywall correctly

---

### 5.5 Match Detection & Celebration

**Priority:** P0 (Must Have)

**User Story:**
_As a user, when someone I liked also likes me back, I want to be notified immediately with a celebration so I can start chatting._

**Requirements:**

**FR-2.3.1 Match Detection (Cloud Function Trigger)**

**Trigger:** `onSwipeCreated` on `/swipes/{userId}/likes/{targetUserId}`

**Logic:**
```javascript
exports.onSwipeCreated = functions
  .firestore.document('swipes/{userId}/likes/{targetUserId}')
  .onCreate(async (snap, context) => {
    const { userId, targetUserId } = context.params;
    const swipeData = snap.data();
    
    // Check if target user has also liked this user
    const mutualLikeDoc = await admin.firestore()
      .doc(`swipes/${targetUserId}/likes/${userId}`)
      .get();
    
    if (mutualLikeDoc.exists) {
      // Create match
      const matchId = [userId, targetUserId].sort().join('_');
      
      await admin.firestore().doc(`matches/${matchId}`).set({
        users: [userId, targetUserId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: null,
        lastMessageTimestamp: null,
        [userId + '_unread']: 0,
        [targetUserId + '_unread']: 0,
      });
      
      // Increment match count for both users
      await admin.firestore().doc(`users/${userId}`).update({
        'stats.matches': admin.firestore.FieldValue.increment(1),
      });
      
      await admin.firestore().doc(`users/${targetUserId}`).update({
        'stats.matches': admin.firestore.FieldValue.increment(1),
      });
      
      // Send push notifications
      await sendMatchNotifications(userId, targetUserId, swipeData.isSuperLike);
    }
  });
```

**FR-2.3.2 Match Celebration Modal**

Appears immediately when match is detected:
- **Animation:**
  * Confetti particles from top (react-native-confetti-cannon)
  * Modal slides up from bottom with spring animation
  * Both user photos zoom in with pulse effect

- **Content:**
  * Headline: "It's a Match!" (large, bold)
  * Both users' primary photos side by side (circular, 120x120)
  * Names below photos
  * Shared activity badges (highlight common interests)

- **Actions:**
  * "Send Message" (primary button) → Opens chat with pre-filled icebreaker suggestion
  * "Keep Swiping" (secondary button) → Dismisses modal, returns to discovery

**FR-2.3.3 Icebreaker Suggestions**
When user taps "Send Message", suggest contextual openers:
- "Hey {name}! I see you're into {shared_activity}. What's your favorite {related_question}?"
- "Hi {name}! {shared_activity} is my favorite too! How often do you go?"
- Default: "Hey {name}! Excited to match with you!"

**FR-2.3.4 Match Notification**
- Real-time in-app notification badge on Matches tab
- Push notification (if enabled):
  * Title: "New Match!"
  * Body: "You and {name} liked each other!"
  * Image: Other user's primary photo
  * Deep link to chat screen

**Acceptance Criteria:**
- [ ] Match is created within 1 second of mutual like
- [ ] Celebration modal appears with smooth animations
- [ ] Confetti animation plays
- [ ] Icebreaker suggestions are contextual
- [ ] User can immediately message or continue swiping

---

### 5.6 Full Profile Modal

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to view someone's complete profile before deciding to like them so I can make an informed decision._

**Requirements:**

**FR-2.4.1 Modal Layout**

**Scrollable sections:**

1. **Photo Gallery**
   - Horizontal scrollable (all photos)
   - Full-width photos with pagination dots
   - Tap to view fullscreen with pinch-to-zoom
   - Swipe or tap sides to navigate

2. **Basic Info**
   - Name, Age (headline)
   - Location (city, distance)
   - Verified badge
   - Online status ("Active now" or "Active 2h ago")

3. **Bio**
   - Full bio text
   - Expandable if >200 characters ("Read more")

4. **Fitness Profile Card**
   - Section title: "Fitness & Activities"
   - Activities (chips with icons, highlight shared with user in different color)
   - Fitness Level badge
   - Workout Frequency
   - Goals (list with icons)

5. **Lifestyle Card**
   - Section title: "Lifestyle"
   - Diet (with icon)
   - Smoking status
   - Drinking status

6. **About Card**
   - Height
   - Religion (if provided)

7. **Today's Activity** (if shared)
   - Section title: "Today's Activity"
   - Steps, Distance, Calories
   - Recent workout type and duration
   - Powered by (Strava/Apple Health/Google Fit logo)

8. **Shared Interests Highlight**
   - Section: "What You Have in Common"
   - List shared activities with checkmarks
   - "You both are {fitness_level}"
   - "You both prefer {diet}"

**FR-2.4.2 Action Buttons (Fixed Bottom Bar)**
- Pass (X icon, red, outline)
- Like (Heart icon, green, filled)
- Super Like (Star icon, blue, filled) - Shows paywall if free

**FR-2.4.3 Additional Actions**
- Report button (top right, flag icon)
- Close button (top left, X icon)

**FR-2.4.4 Behavior**
- Modal slides up from bottom (full screen on phones, card on tablets)
- Dismiss by swiping down or tapping close
- Swipe left/right on photo gallery navigates photos
- Actions persist: Like/Pass/Super Like work same as in card stack
- After action, modal dismisses and returns to stack

**Acceptance Criteria:**
- [ ] Modal displays all profile information clearly
- [ ] Shared interests are highlighted prominently
- [ ] Actions (like/pass/super like) work from modal
- [ ] Smooth animations and transitions
- [ ] Fullscreen photo viewer works

---

## Epic 3: Messaging & Matches

### 5.7 Matches Screen

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to see all my matches in one place and easily start conversations._

**Requirements:**

**FR-3.1.1 Tab Navigation**
Two tabs at top:
1. **Matches Tab**: Shows all matches (grid view)
2. **Messages Tab**: Shows only matches with message history (list view)

**FR-3.1.2 Matches Grid View**
- 3-column grid
- Each card displays:
  * Primary photo (3:4 aspect ratio)
  * Name overlay at bottom
  * "NEW" badge (green, top right) if no messages exchanged
  * Unread count badge (red, top right) if messages unread
  * Online indicator (green dot, bottom right) if active in last 5 minutes
- Tap card → Navigate to ChatScreen
- Long press → Show action sheet:
  * View Profile
  * Unmatch
  * Report

**FR-3.1.3 Messages List View**
- FlatList sorted by lastMessageTimestamp (descending)
- Each row shows:
  * User's primary photo (circular, 60x60, left)
  * Name (bold)
  * Last message preview (gray, max 2 lines, truncated)
  * Timestamp (right side):
    * "Just now" (<1 min)
    * "5m", "2h" (<24h)
    * "Yesterday"
    * "Mon", "Tue" (this week)
    * "Jan 15" (older)
  * Unread count badge (red circle with number)
  * Online status dot (green, on photo)
- Swipe left reveals "Unmatch" button (destructive, red)
- Tap row → Navigate to ChatScreen
- Pull to refresh

**FR-3.1.4 Empty States**

**Matches Tab (no matches):**
- Illustration: Heart with magnifying glass
- Headline: "No Matches Yet"
- Subtitle: "Start swiping to find your fitness match!"
- CTA: "Start Swiping" button → Navigate to Discover

**Messages Tab (no messages):**
- Illustration: Chat bubble with heart
- Headline: "No Messages Yet"
- Subtitle: "Say hi to your matches and break the ice!"
- CTA: "View Matches" button → Switch to Matches tab

**FR-3.1.5 Real-time Updates**
- Firestore listener on `/matches` collection where user ID in users array
- New matches appear instantly with animation (slide in from top)
- Unread count updates in real-time
- Last message updates in real-time
- Online status updates every 30 seconds

**FR-3.1.6 Search & Filter (Premium)**
- Search bar at top (premium only)
- Filter by:
  * Name
  * Activity
  * Recently active
- Show paywall if free user attempts to use

**Acceptance Criteria:**
- [ ] Matches load within 2 seconds
- [ ] Grid and list views both functional
- [ ] Real-time updates work correctly
- [ ] Swipe to unmatch works smoothly
- [ ] Empty states show appropriate messaging
- [ ] Online status accurate within 1 minute

---

### 5.8 Real-time Chat System

**Priority:** P0 (Must Have)

**User Story:**
_As a matched user, I want to send messages and photos instantly so I can get to know my match better._

**Requirements:**

**FR-3.2.1 Chat Screen Header**
- Back button (left)
- User's primary photo (circular, 40x40, tappable → View Profile)
- Name
- Online status text:
  * "Active now" (green) if online
  * "Active 5m ago", "Active 2h ago", etc. if recently active
  * No text if offline >24h
- Menu button (3 dots, right) → Action sheet:
  * View Profile
  * Unmatch
  * Report User

**FR-3.2.2 Messages List (FlatList Inverted)**

**Message Types:**

1. **Text Message**
   - Sent messages:
     * Right-aligned
     * Primary color background (#4CAF50)
     * White text
     * Rounded corners (18px), flat on bottom-right
     * Max width: 75% of screen
   - Received messages:
     * Left-aligned
     * Light gray background (#F0F0F0)
     * Dark text (#333)
     * Rounded corners (18px), flat on bottom-left
     * Max width: 75% of screen

2. **Image Message**
   - Displays image thumbnail (max 200x200)
   - Tap to view fullscreen
   - Send button shows while uploading
   - Failed upload shows retry button

3. **System Message**
   - Centered, gray text
   - Examples:
     * "You matched on Jan 15, 2026"
     * "You unmatched this user"

**Message Metadata:**
- Timestamp (show on long press or every 5th message)
- Read receipts (sent messages only):
  * Single checkmark: Sent
  * Double checkmark: Delivered
  * Blue double checkmark: Read

**FR-3.2.3 Date Headers**
- Group messages by date
- Section headers:
  * "Today"
  * "Yesterday"
  * Date (e.g., "Monday, January 15")

**FR-3.2.4 Typing Indicator**
- Appears when other user is typing
- Animated three dots (bounce animation)
- Shows just above input bar
- Text: "{Name} is typing..."

**FR-3.2.5 Input Bar**

**Layout:**
- Image picker button (left, gallery icon)
- Text input (center):
  * Multiline
  * Auto-grow (max 4 lines)
  * Placeholder: "Type a message..."
  * Max length: 1000 characters
- Send button (right, paper plane icon):
  * Disabled (gray) when input empty
  * Enabled (primary color) when text present
  * Tap to send

**Keyboard Handling:**
- KeyboardAvoidingView with proper offset
- Input bar sticks to keyboard
- Messages scroll up when keyboard opens
- Dismiss keyboard on scroll

**FR-3.2.6 Message Actions**

**Long Press Message:**
- Copy (text messages only)
- Delete (own messages only)
- Report (received messages only)

**FR-3.2.7 Image Handling**
- **Send Image:**
  1. Tap gallery icon
  2. Pick image from library
  3. Optional: Crop/edit (use expo-image-manipulator)
  4. Compress to max 2MB
  5. Upload to Storage `/chats/{matchId}/images/{messageId}.jpg`
  6. Send message with imageUrl
  7. Show upload progress

- **View Image:**
  1. Tap thumbnail
  2. Open fullscreen modal
  3. Pinch to zoom
  4. Swipe to dismiss

**FR-3.2.8 Firebase Realtime Database Schema**

```javascript
/chats/{matchId}
  /messages/{messageId}
    senderId: string
    text: string | null
    imageUrl: string | null
    timestamp: number (server timestamp)
    read: boolean
  
  /metadata
    participants: [uid1, uid2]
    lastMessage: string
    lastMessageTimestamp: number
    uid1_typing: boolean
    uid2_typing: boolean
    uid1_unread: number
    uid2_unread: number
  
  /presence
    uid1_online: boolean
    uid1_lastSeen: number
    uid2_online: boolean
    uid2_lastSeen: number
```

**FR-3.2.9 Real-time Listeners**

**Messages:**
```typescript
const messagesRef = ref(rtdb, `chats/${matchId}/messages`);
onValue(messagesRef, (snapshot) => {
  const data = snapshot.val();
  // Update messages state
  // Mark as read
});
```

**Typing Indicator:**
```typescript
// Listen to other user typing
const typingRef = ref(rtdb, `chats/${matchId}/metadata/${otherUserId}_typing`);
onValue(typingRef, (snapshot) => {
  setIsTyping(snapshot.val() === true);
});

// Update own typing status (debounced 1 second)
useEffect(() => {
  if (inputText.length > 0) {
    set(ref(rtdb, `chats/${matchId}/metadata/${userId}_typing`), true);
    const timeout = setTimeout(() => {
      set(ref(rtdb, `chats/${matchId}/metadata/${userId}_typing`), false);
    }, 1000);
    return () => clearTimeout(timeout);
  }
}, [inputText]);
```

**Online Presence:**
```typescript
// Set online when chat opens
const presenceRef = ref(rtdb, `chats/${matchId}/presence/${userId}_online`);
set(presenceRef, true);
set(ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`), serverTimestamp());

// Set offline on disconnect
onDisconnect(presenceRef).set(false);
onDisconnect(ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`)).set(serverTimestamp());
```

**FR-3.2.10 Mark Messages as Read**
When chat screen is active:
- Mark all unread messages from other user as read
- Update RTDB: `chats/{matchId}/messages/{messageId}/read = true`
- Update Firestore: `matches/{matchId}/{userId}_unread = 0`
- Send read receipt to sender

**FR-3.2.11 Send Message Flow**
```typescript
const sendMessage = async (text: string, imageUrl?: string) => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`);
  const newMessageRef = push(messagesRef);
  
  const message = {
    senderId: userId,
    text: text || null,
    imageUrl: imageUrl || null,
    timestamp: serverTimestamp(),
    read: false,
  };
  
  // Write to RTDB
  await set(newMessageRef, message);
  
  // Update Firestore match metadata
  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: text || 'Photo',
    lastMessageTimestamp: serverTimestamp(),
    [`${otherUserId}_unread`]: increment(1),
  });
  
  // Cloud Function sends push notification
};
```

**FR-3.2.12 Push Notifications**

**Trigger:** New message in RTDB

**Cloud Function:**
```typescript
export const onNewMessage = functions
  .database.ref('/chats/{matchId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.val();
    const { matchId } = context.params;
    
    // Get recipient user
    const matchDoc = await admin.firestore().doc(`matches/${matchId}`).get();
    const recipients = matchDoc.data().users;
    const recipientId = recipients.find(id => id !== message.senderId);
    
    // Get recipient's push token
    const userDoc = await admin.firestore().doc(`users/${recipientId}`).get();
    const expoPushToken = userDoc.data().expoPushToken;
    
    if (!expoPushToken) return;
    
    // Get sender's name
    const senderDoc = await admin.firestore().doc(`users/${message.senderId}`).get();
    const senderName = senderDoc.data().firstName;
    
    // Send notification
    await admin.messaging().send({
      token: pushToken,
      notification: {
        title: senderName,
        body: message.text || 'Sent a photo',
      },
      data: {
        type: 'message',
        matchId,
        senderId: message.senderId,
      },
    });
  });
```

**FR-3.2.13 Unmatch Functionality**

**Flow:**
1. User taps "Unmatch" from menu or swipe action
2. Show confirmation alert:
   * Title: "Unmatch {name}?"
   * Message: "This will remove the match and delete all messages"
   * Buttons: "Cancel", "Unmatch" (destructive)
3. If confirmed:
   * Delete match from Firestore `/matches/{matchId}`
   * Delete chat from RTDB `/chats/{matchId}`
   * Add to blocked list `/blocked/{userId}/{otherUserId}` (prevent re-matching)
   * Navigate back to Matches screen

**FR-3.2.14 Performance Optimizations**
- Pagination: Load 50 messages initially
- Load more on scroll to top (infinite scroll)
- Image caching with expo-image
- Debounce typing indicator (1 second)
- Throttle scroll events (60fps)
- Detach listeners on unmount (prevent memory leaks)

**Acceptance Criteria:**
- [ ] Messages send and appear within 1 second
- [ ] Real-time updates work for messages, typing, online status
- [ ] Images upload and display correctly
- [ ] Read receipts update accurately
- [ ] Unmatch flow works and prevents re-matching
- [ ] Push notifications delivered within 10 seconds
- [ ] Chat UI smooth on low-end devices (60fps)

---

## Epic 4: User Profile & Settings

### 5.9 Own Profile Screen

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to view and manage my profile so I can present myself well and update my information._

**Requirements:**

**FR-4.1.1 Profile Layout (ScrollView)**

1. **Header Section**
   - Primary photo (large, full-width, 16:9 aspect ratio)
   - Edit button (floating, top right, pencil icon)
   - Name, Age (overlay on photo, bottom left)
   - Location (city, state)
   - Verified badge (if photoVerified === true)

2. **Quick Stats Row** (3 columns)
   - Total Matches (number + "Matches" label)
   - Profile Views (number + "Views" label) 
   - Days Active (calculated from createdAt)

3. **Photo Gallery**
   - Horizontal scrollable grid (6 slots)
   - Current photos displayed
   - Empty slots show "+" icon
   - Tap photo → View fullscreen
   - Long press → Delete photo (confirmation)
   - Drag to reorder (react-native-draggable-flatlist)

4. **Verification Card** (if not verified)
   - Icon: Blue checkmark
   - Headline: "Verify Your Profile"
   - Subtitle: "Stand out and build trust with a verified badge"
   - CTA: "Verify Now" button → Photo verification flow

5. **Bio Section**
   - Label: "About Me"
   - Full bio text
   - Edit button (inline)

6. **Info Cards** (Collapsible/Expandable)

   **Basic Info Card:**
   - Height: {height} cm
   - Location: {city}, {state}
   - Religion: {religion or "Not specified"}
   - Edit button

   **Fitness Profile Card:**
   - Activities: {activity chips}
   - Fitness Level: {level badge}
   - Workout Frequency: {frequency}
   - Goals: {bulleted list}
   - Edit button

   **Lifestyle Card:**
   - Diet: {diet with icon}
   - Smoking: {status}
   - Drinking: {status}
   - Edit button

7. **Connected Apps** (if any connected)
   - Section: "Today's Activity"
   - Stats: Steps, Calories, Distance
   - Source logo (Apple Health/Google Fit/Strava)
   - Last synced: {timestamp}
   - Manage button → Settings > Connected Apps

8. **Action Buttons**
   - "Edit Profile" (primary, green)
   - "Settings" (outline, gray)
   - "Get Premium" (gradient, blue-to-green) - if free user

**FR-4.1.2 Navigation**
- Edit Profile button → EditProfileScreen
- Settings button → SettingsScreen
- Get Premium button → PremiumScreen
- Verify Now button → PhotoVerificationScreen

**Acceptance Criteria:**
- [ ] Profile displays all user data correctly
- [ ] Photos can be reordered by dragging
- [ ] Verification card shows only if not verified
- [ ] Stats calculate correctly
- [ ] All navigation works

---

### 5.10 Edit Profile Screen

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to update my profile information easily so I can keep it current and accurate._

**Requirements:**

**FR-4.2.1 Screen Layout**

**Header:**
- Title: "Edit Profile"
- Close button (left)
- Save button (right, enabled only if form isDirty)

**Sections (ScrollView):**

1. **Photos Section**
   - Label: "Photos (Min 2, Max 6)"
   - Photo grid (6 slots, 2 columns)
   - Drag to reorder
   - Tap empty slot → Pick image
   - Tap existing photo → Options:
     * Replace
     * Delete (confirm if <3 total photos)
   - Guidelines box:
     * "Clear face photos work best"
     * "No group photos"
     * "Avoid heavy filters"

2. **Basic Info Section**
   - First Name (input, 2-50 chars)
   - Date of Birth (date picker, DISABLED with info icon)
     * Info: "Contact support to change DOB"
   - Gender (segmented control): Male, Female, Non-binary
   - Location (autocomplete): City, State, Country

3. **Fitness Profile Section**
   - Label: "Fitness & Activities"
   - Activities (multi-select chips with search)
     * Show all 16 activities
     * Selected chips highlighted
     * Min 1, Max 10
   - Fitness Level (radio buttons card)
   - Workout Frequency (dropdown)
   - Goals (multi-select list, max 5)

4. **Lifestyle Section**
   - Dietary Preference (dropdown with icons)
   - Smoking (radio buttons)
   - Drinking (radio buttons)

5. **About Section**
   - Bio (textarea, 50-500 chars)
     * Character counter below
     * Placeholder: "Tell people about yourself..."
   - Height (slider, 140-220 cm with live label)
   - Religion (dropdown, optional)

6. **Preferences Section**
   - Label: "Who You're Looking For"
   - Looking For (multi-select): Friends, Workout partners, Dating
   - Age Range (dual slider, 18-60)
   - Distance Range (slider, 5-100 km)
   - Gender Preference (multi-select): Men, Women, Everyone

**FR-4.2.2 Form Validation (Zod Schema)**

```typescript
const editProfileSchema = z.object({
  firstName: z.string().min(2, "Name too short").max(50, "Name too long"),
  gender: z.enum(['male', 'female', 'non-binary']),
  location: z.object({
    city: z.string().min(1, "City required"),
    state: z.string(),
    country: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  bio: z.string().min(50, "Bio must be at least 50 characters").max(500),
  height: z.number().min(140).max(220),
  religion: z.string().optional(),
  fitnessProfile: z.object({
    activities: z.array(z.string()).min(1).max(10),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'athlete']),
    frequency: z.string(),
  }),
  lifestyle: z.object({
    diet: z.string(),
    goals: z.array(z.string()).min(1).max(5),
    smoking: z.enum(['yes', 'no', 'occasionally']),
    drinking: z.enum(['yes', 'no', 'socially']),
  }),
  preferences: z.object({
    lookingFor: z.array(z.string()).min(1),
    ageRange: z.tuple([z.number().min(18), z.number().max(60)]),
    distanceRange: z.number().min(5).max(100),
    genderPreference: z.array(z.string()).min(1),
  }),
});
```

**FR-4.2.3 Form Behavior**

**Save Flow:**
1. User makes changes (form isDirty = true)
2. Save button becomes enabled
3. User taps Save
4. Validate all fields
5. If invalid: Show error messages inline
6. If valid:
   * Show loading spinner
   * Upload new photos (if any)
   * Update Firestore `/users/{userId}`
   * Update local state (Zustand)
   * Show success toast: "Profile updated"
   * Navigate back

**Unsaved Changes:**
- If user taps Close with unsaved changes:
  * Show alert: "Discard changes?"
  * Options: "Keep Editing", "Discard"

**Optimistic Updates:**
- Photos show immediately in UI
- Upload in background
- Show upload progress
- Rollback if upload fails

**FR-4.2.4 Photo Upload**

```typescript
const uploadPhoto = async (uri: string, index: number) => {
  // Compress image
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );
  
  // Upload to Storage
  const filename = `users/${userId}/photos/photo_${index}_${Date.now()}.jpg`;
  const response = await fetch(compressed.uri);
  const blob = await response.blob();
  
  const storageRef = ref(storage, filename);
  const uploadTask = uploadBytesResumable(storageRef, blob);
  
  // Track progress
  uploadTask.on('state_changed', 
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      setUploadProgress(progress);
    },
    (error) => {
      throw error;
    },
    async () => {
      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      return downloadUrl;
    }
  );
};
```

**FR-4.2.5 Error Handling**
- Network errors: Show retry option
- Upload failures: Keep local photo, retry later
- Validation errors: Inline messages with red text
- Generic errors: Toast notification

**Acceptance Criteria:**
- [ ] All fields editable except DOB
- [ ] Validation works with helpful error messages
- [ ] Photos upload successfully with progress
- [ ] Unsaved changes prompt works
- [ ] Form persists on successful save
- [ ] Changes reflect immediately in profile view

---

### 5.11 Settings Screen

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to control my app settings and privacy preferences so I have a personalized and safe experience._

**Requirements:**

**FR-4.3.1 Settings Layout (Grouped List)**

**1. Account Section**
- Phone Number: {phoneNumber} (view only, verified checkmark)
- Email: {email or "Add Email"} (tappable if none)
- Change Password (if email auth enabled)
- Language: Dropdown
  * English
  * Bahasa Melayu
  * 中文 (Simplified Chinese)
  * தமிழ் (Tamil)
- Logout button (red text, confirmation required)

**2. Discovery Section**
- Pause Account (toggle switch)
  * When ON: Profile hidden from discovery
  * Existing matches remain
  * Warning text: "Your profile will be hidden"
- Discovery Preferences button
  * Opens modal to edit: Looking For, Age Range, Distance Range, Gender Preference
  * Same UI as onboarding Step 6

**3. Notifications Section**
- Push Notifications (master toggle)
  * Requests permission if not granted
  * If denied: Show settings link
- Granular settings (only if push enabled):
  * New Matches (toggle)
  * New Messages (toggle)
  * Someone Liked You (toggle, PREMIUM ONLY badge)
  * Workout Reminders (toggle, future feature)
- Email Notifications (toggle)
  * Marketing emails
  * Product updates

**4. Privacy Section**
- Show Me on fitlink (toggle)
  * ON: Profile visible
  * OFF: Hidden from discovery, matches can still message
- Blocked Users (arrow right)
  * Opens BlockedUsersScreen
  * Shows list of blocked users
  * Tap to unblock
- Data & Privacy (arrow right)
  * Opens web view: privacy policy
  * Link: https://fitlink.app/privacy

**5. Premium Section** 

**If Free User:**
- Card with gradient background
- "Upgrade to Premium" headline
- Benefits list (icons + text):
  * Unlimited Likes
  * See Who Liked You
  * Advanced Filters
  * Priority Profile
- "Upgrade Now" button → PremiumScreen

**If Premium User:**
- Current Plan: "Premium Plus" (badge)
- Renewal Date: "Renews on {date}"
- Manage Subscription button → Opens Stripe Customer Portal
- Cancel Subscription (in portal)

**6. Connected Apps Section**
- Apple Health (iOS only)
  * Toggle switch
  * Last synced: {timestamp}
- Google Fit (Android only)
  * Toggle switch  
  * Last synced: {timestamp}
- Strava
  * "Connect" or "Connected" status
  * "Disconnect" button if connected
- Share Activity on Profile (toggle)
  * Only shows if at least one app connected
  * When ON: Today's stats visible to matches

**7. Support Section**
- Help Center (arrow right)
  * Opens web view or in-app help
  * Link: https://help.fitlink.app
- Contact Us (arrow right)
  * Opens email: support@fitlink.app
  * Pre-fills subject: "Support Request"
- Rate fitlink (arrow right)
  * Deep link to App Store/Play Store
- Terms of Service (arrow right)
  * Web view: https://fitlink.app/terms
- Privacy Policy (arrow right)
  * Web view: https://fitlink.app/privacy
- App Version (view only): v1.0.0

**8. Danger Zone Section**
- Delete Account button (red, outline)
  * Opens DeleteAccountScreen
  * Requires password confirmation
  * Shows list of what will be deleted
  * Final confirmation required

**FR-4.3.2 Logout Flow**
1. User taps Logout
2. Alert confirmation:
   * Title: "Logout?"
   * Message: "Are you sure you want to logout?"
   * Buttons: "Cancel", "Logout" (destructive)
3. If confirmed:
   * Clear local auth state (Zustand)
   * Sign out from Firebase Auth
   * Clear AsyncStorage cache
   * Navigate to WelcomeScreen

**FR-4.3.3 Push Notifications**

**Request Permission:**
```typescript
const requestPushPermission = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notifications Disabled',
      'Enable notifications in your device settings to get notified of new matches and messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  
  // Get push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Save to Firestore
  await updateDoc(doc(db, 'users', userId), {
    expoPushToken: token,   // matches Firestore schema field name
  });
  
  return true;
};
```

**FR-4.3.4 Language Change**
- Immediately applies to all app text (i18next)
- No app restart required
- Saves to Firestore: `users/{userId}/language`
- Updates device locale preference

**FR-4.3.5 Pause Account**
- When toggled ON:
  * Update Firestore: `users/{userId}/paused = true`
  * Profile hidden from discovery stack
  * Existing matches can still message
  * User can still swipe and message
- When toggled OFF:
  * Update: `paused = false`
  * Profile visible again in discovery

**Acceptance Criteria:**
- [ ] All settings update immediately
- [ ] Logout clears all local data
- [ ] Push notifications request permission correctly
- [ ] Language change applies without restart
- [ ] Pause account hides profile from discovery
- [ ] Premium status displays correctly

---

### 5.12 Premium/Subscription Screen

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to upgrade to premium to unlock advanced features and improve my dating experience._

**Requirements:**

**FR-4.4.1 Screen Layout**

**Hero Section:**
- Gradient background (primary to secondary color)
- Headline: "Unlock Your Full Potential"
- Subheadline: "Find your perfect match faster"
- Lottie animation (hearts, fitness icons)

**Billing Period Selector:**
- Segmented control:
  * Monthly (default)
  * 3 Months (Save 10% badge)
  * 6 Months (Save 20% badge)
- Shows savings amount

**Pricing Cards (Horizontal Scroll):**

**Plus Tier:**
- Price: RM 29.90/month (or equivalent)
- Billed: "Billed monthly" or "Billed RM 89.90 every 3 months"
- Features (checkmarks):
  * ✓ Unlimited Likes
  * ✓ See Who Liked You
  * ✓ 5 Super Likes per week
  * ✓ Advanced Filters
  * ✓ Rewind Last Swipe
  * ✓ No Ads
- Select button (outline)

**Pro Tier (Highlighted):**
- Badge: "Most Popular"
- Price: RM 49.90/month (or equivalent)
- Billed: Amount x period
- Features (checkmarks):
  * ✓ Everything in Plus
  * ✓ Priority Profile (2x visibility)
  * ✓ Read Receipts
  * ✓ Unlimited Super Likes
  * ✓ Incognito Mode
  * ✓ Boost Profile (1x per month)
- Select button (filled, gradient)

**Feature Comparison Table:**
- Expandable section: "Compare All Features"
- Table with Free, Plus, Pro columns
- All features listed with checkmarks

**Subscribe Button:**
- Fixed bottom bar
- "Subscribe for {price}" (updates based on selection)
- Tap → Stripe payment flow

**Legal Text:**
- Small, gray text:
  * "Auto-renews {period}. Cancel anytime."
  * Links: Terms, Privacy Policy

**FR-4.4.2 Localized Pricing**

**Currencies & Pricing:**
- Malaysia (MYR):
  * Plus: RM 29.90/month, RM 80.91/3 months, RM 143.52/6 months
  * Pro: RM 49.90/month, RM 134.73/3 months, RM 239.52/6 months

- Singapore (SGD):
  * Plus: S$12.90/month, S$34.83/3 months, S$61.92/6 months
  * Pro: S$19.90/month, S$53.73/3 months, S$95.52/6 months

- Thailand (THB):
  * Plus: ฿299/month, ฿807/3 months, ฿1,435/6 months
  * Pro: ฿499/month, ฿1,347/3 months, ฿2,395/6 months

- Philippines (PHP):
  * Plus: ₱499/month, ₱1,347/3 months, ₱2,395/6 months
  * Pro: ₱799/month, ₱2,157/3 months, ₱3,835/6 months

- Indonesia (IDR):
  * Plus: Rp 129,000/month, Rp 348,300/3 months, Rp 619,200/6 months
  * Pro: Rp 199,000/month, Rp 537,300/3 months, Rp 955,200/6 months

- Vietnam (VND):
  * Plus: ₫249,000/month, ₫672,300/3 months, ₫1,195,200/6 months
  * Pro: ₫399,000/month, ₫1,077,300/3 months, ₫1,915,200/6 months

**Detect currency:**
```typescript
const getCurrency = () => {
  const country = user.location.country;
  const currencyMap = {
    'Malaysia': 'MYR',
    'Singapore': 'SGD',
    'Thailand': 'THB',
    'Philippines': 'PHP',
    'Indonesia': 'IDR',
    'Vietnam': 'VND',
  };
  return currencyMap[country] || 'MYR'; // Default to MYR
};
```

**FR-4.4.3 Stripe Payment Integration**

**Payment Flow:**
1. User selects plan and billing period
2. Taps "Subscribe for {price}"
3. Call Cloud Function: `createStripeCheckout`
4. Initialize Stripe Payment Sheet
5. Present payment UI (Stripe handles):
   * Card input
   * FPX (Malaysia)
   * Other local payment methods
   * 3D Secure authentication
6. Process payment
7. Webhook updates Firestore
8. Show success screen
9. Unlock premium features

**Cloud Function: createStripeCheckout**
```typescript
export const createStripeCheckout = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    
    const { priceId, userId } = data;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Get or create Stripe customer
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    let customerId = userDoc.data()?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userDoc.data()?.email,
        metadata: { firebaseUID: userId },
      });
      customerId = customer.id;
      
      await admin.firestore().doc(`users/${userId}`).update({
        stripeCustomerId: customerId,
      });
    }
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    
    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    };
  });
```

**Webhook Handler: stripeWebhook**
```typescript
export const stripeWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sig = req.headers['stripe-signature']!;
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      
      // Handle subscription created/updated
      if (event.type === 'customer.subscription.created' || 
          event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Find user by Stripe customer ID
        const usersSnapshot = await admin.firestore()
          .collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (usersSnapshot.empty) {
          console.error('User not found for customer:', customerId);
          return res.sendStatus(404);
        }
        
        const userId = usersSnapshot.docs[0].id;
        const priceId = subscription.items.data[0].price.id;
        
        // Determine tier from price ID
        let tier = 'plus';
        if (priceId.includes('pro')) tier = 'pro';
        
        // Update Firestore
        await admin.firestore().doc(`users/${userId}`).update({
          'premium.active': subscription.status === 'active',
          'premium.tier': tier,
          'premium.subscriptionId': subscription.id,
          'premium.expiresAt': admin.firestore.Timestamp.fromMillis(
            subscription.current_period_end * 1000
          ),
        });
      }
      
      // Handle subscription deleted/canceled
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const usersSnapshot = await admin.firestore()
          .collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          const userId = usersSnapshot.docs[0].id;
          await admin.firestore().doc(`users/${userId}`).update({
            'premium.active': false,
            'premium.tier': null,
            'premium.subscriptionId': null,
            'premium.expiresAt': null,
          });
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook error:', error);
      res.sendStatus(400);
    }
  });
```

**FR-4.4.4 Payment Methods**

**Supported Methods by Region:**
- Malaysia: Cards, FPX, GrabPay, Touch 'n Go eWallet
- Singapore: Cards, PayNow, GrabPay
- Thailand: Cards, PromptPay, TrueMoney
- Philippines: Cards, GCash, PayMaya
- Indonesia: Cards, OVO, GoPay, Dana
- Vietnam: Cards, MoMo, ZaloPay

**Stripe Configuration:**
```typescript
const { error } = await initPaymentSheet({
  merchantDisplayName: 'fitlink',
  customerId,
  customerEphemeralKeySecret: ephemeralKey,
  paymentIntentClientSecret: clientSecret,
  allowsDelayedPaymentMethods: true,
  returnURL: 'fitlink://payment-complete',
  appearance: {
    colors: {
      primary: '#4CAF50',
    },
  },
  defaultBillingDetails: {
    email: user.email,
  },
});
```

**FR-4.4.5 Success/Failure Handling**

**Success:**
- Show success modal with confetti
- "Welcome to Premium!" headline
- List of unlocked features
- "Start Exploring" button → Dismiss and return to app

**Failure:**
- Alert with error message
- "Try Again" button → Retry payment
- "Contact Support" button → Email support

**Acceptance Criteria:**
- [ ] Pricing displays in correct local currency
- [ ] All billing periods calculate correctly
- [ ] Stripe payment sheet opens and processes payments
- [ ] Webhook updates Firestore within 30 seconds
- [ ] Premium features unlock immediately after successful payment
- [ ] Failed payments show helpful error messages
- [ ] Subscription management works (upgrade/downgrade/cancel)

---

## Epic 5: Fitness Integrations

### 5.13 Health & Activity Tracking

**Priority:** P1 (Should Have)

**User Story:**
_As a fitness enthusiast, I want to connect my fitness apps so I can share my real activity with matches and stand out as an active person._

**Requirements:**

**FR-5.1.1 Apple Health Integration (iOS)**

**Permissions:**
- Steps
- Distance (walking + running)
- Active Energy Burned
- Workouts

**Implementation:**
```typescript
import AppleHealthKit from 'react-native-health';

const requestAppleHealthPermission = async () => {
  const permissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.Steps,
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.Workout,
      ],
    },
  };
  
  AppleHealthKit.initHealthKit(permissions, (err) => {
    if (err) {
      console.error('Apple Health permission denied');
      return;
    }
    
    // Save connection status
    updateDoc(doc(db, 'users', userId), {
      'fitnessTracking.appleHealth.connected': true,
      'fitnessTracking.appleHealth.lastSync': serverTimestamp(),
    });
  });
};

const fetchTodayActivity = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const options = {
    date: today.toISOString(),
    includeManuallyAdded: true,
  };
  
  // Get steps
  const steps = await new Promise((resolve) => {
    AppleHealthKit.getStepCount(options, (err, results) => {
      resolve(results?.value || 0);
    });
  });
  
  // Get distance (in meters, convert to km)
  const distance = await new Promise((resolve) => {
    AppleHealthKit.getDistanceWalkingRunning(options, (err, results) => {
      resolve((results?.value || 0) / 1000);
    });
  });
  
  // Get active calories
  const calories = await new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(options, (err, results) => {
      resolve(results?.value || 0);
    });
  });
  
  // Get workouts
  const workouts = await new Promise((resolve) => {
    AppleHealthKit.getSamples(
      {
        startDate: today.toISOString(),
        endDate: new Date().toISOString(),
      },
      'Workout',
      (err, results) => {
        resolve(results || []);
      }
    );
  });
  
  // Update Firestore
  await updateDoc(doc(db, 'users', userId), {
    'fitnessTracking.todayStats': {
      steps,
      distance,
      calories: Math.round(calories),
      workouts: workouts.map(w => ({
        type: w.activityName,
        duration: w.duration,
        calories: w.calories,
      })),
      updatedAt: serverTimestamp(),
    },
  });
};
```

**FR-5.1.2 Google Fit Integration (Android)**

**Permissions:**
- Steps
- Distance
- Calories
- Activity Sessions

**Implementation:**
```typescript
import GoogleFit from 'react-native-google-fit';

const requestGoogleFitPermission = async () => {
  const options = {
    scopes: [
      Scopes.FITNESS_ACTIVITY_READ,
      Scopes.FITNESS_LOCATION_READ,
      Scopes.FITNESS_BODY_READ,
    ],
  };
  
  const authorized = await GoogleFit.authorize(options);
  
  if (authorized) {
    await updateDoc(doc(db, 'users', userId), {
      'fitnessTracking.googleFit.connected': true,
      'fitnessTracking.googleFit.lastSync': serverTimestamp(),
    });
  }
};

const fetchTodayActivity = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  
  const options = {
    startDate: today.toISOString(),
    endDate: now.toISOString(),
  };
  
  // Get daily steps
  const steps = await GoogleFit.getDailyStepCountSamples(options);
  const totalSteps = steps.find(s => s.source === 'com.google.android.gms')?.steps || 0;
  
  // Get distance
  const distances = await GoogleFit.getDailyDistanceSamples(options);
  const totalDistance = distances.reduce((sum, d) => sum + d.distance, 0) / 1000; // km
  
  // Get calories
  const calories = await GoogleFit.getDailyCalorieSamples(options);
  const totalCalories = calories.reduce((sum, c) => sum + c.calorie, 0);
  
  // Get activity sessions
  const sessions = await GoogleFit.getActivitySamples(options);
  
  // Update Firestore
  await updateDoc(doc(db, 'users', userId), {
    'fitnessTracking.todayStats': {
      steps: totalSteps,
      distance: totalDistance,
      calories: Math.round(totalCalories),
      workouts: sessions.map(s => ({
        type: s.activityName,
        duration: (s.end - s.start) / 60000, // minutes
        calories: s.calories || 0,
      })),
      updatedAt: serverTimestamp(),
    },
  });
};
```

**FR-5.1.3 Strava Integration**

**OAuth Flow:**
1. User taps "Connect Strava" in Settings
2. Open browser to Strava OAuth URL:
   ```
   https://www.strava.com/oauth/authorize?
     client_id={STRAVA_CLIENT_ID}&
     redirect_uri=fitlink://strava-auth&
     response_type=code&
     scope=activity:read_all
   ```
3. User authorizes on Strava
4. Redirect back to app with authorization code
5. Exchange code for access token (Cloud Function)
6. Store refresh token (encrypted) in Firestore

**Cloud Function: exchangeStravaToken**
```typescript
export const exchangeStravaToken = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
    
    const { code, userId } = data;
    
    // Exchange code for tokens
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    
    const tokens = await response.json();
    
    // Encrypt refresh token (use crypto or Cloud KMS)
    const encryptedToken = encrypt(tokens.refresh_token);
    
    // Save to Firestore
    await admin.firestore().doc(`users/${userId}`).update({
      'fitnessTracking.strava.connected': true,
      'fitnessTracking.strava.accessToken': tokens.access_token,
      'fitnessTracking.strava.refreshToken': encryptedToken,
      'fitnessTracking.strava.expiresAt': tokens.expires_at,
      'fitnessTracking.strava.lastSync': admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  });
```

**Fetch Strava Activities:**
```typescript
export const syncStravaActivity = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
    
    const userId = context.auth.uid;
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    const strava = userDoc.data()?.fitnessTracking?.strava;
    
    if (!strava?.connected) {
      throw new functions.https.HttpsError('failed-precondition', 'Strava not connected');
    }
    
    // Refresh token if expired
    let accessToken = strava.accessToken;
    if (Date.now() / 1000 > strava.expiresAt) {
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: decrypt(strava.refreshToken),
        }),
      });
      
      const newTokens = await refreshResponse.json();
      accessToken = newTokens.access_token;
      
      // Update tokens in Firestore
      await admin.firestore().doc(`users/${userId}`).update({
        'fitnessTracking.strava.accessToken': accessToken,
        'fitnessTracking.strava.expiresAt': newTokens.expires_at,
      });
    }
    
    // Fetch activities (last 7 days)
    const after = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    
    const activities = await activitiesResponse.json();
    
    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActivities = activities.filter(a => 
      new Date(a.start_date) >= today
    );
    
    const stats = {
      steps: 0, // Strava doesn't track steps
      distance: todayActivities.reduce((sum, a) => sum + a.distance, 0) / 1000, // km
      calories: todayActivities.reduce((sum, a) => sum + (a.calories || 0), 0),
      workouts: todayActivities.map(a => ({
        type: a.type,
        duration: a.moving_time / 60, // minutes
        distance: a.distance / 1000,
        elevation: a.total_elevation_gain,
      })),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await admin.firestore().doc(`users/${userId}`).update({
      'fitnessTracking.todayStats': stats,
      'fitnessTracking.strava.lastSync': admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return stats;
  });
```

**FR-5.1.4 Connected Apps UI (Settings)**

**Connected Apps Screen:**
- List of available integrations:
  * Apple Health (iOS only) - Toggle
  * Google Fit (Android only) - Toggle
  * Strava - "Connect" or "Disconnect" button

- When connected:
  * Green checkmark icon
  * Last synced: {timestamp}
  * "Sync Now" button (refresh data)
  * "Disconnect" button

- Share Settings:
  * "Show activity on profile" toggle
  * When ON: Today's stats visible to matches (not in discovery)
  * When OFF: Activity data private

**FR-5.1.5 Activity Display on Profile**

**Own Profile:**
- "Today's Activity" card (if data available)
- Icons: 👟 Steps, 🔥 Calories, 📏 Distance
- Recent workout (if any): "{type} - {duration} min"
- Source logo: Apple Health/Google Fit/Strava
- Last updated: "5 min ago"
- Tap card → Detailed breakdown modal

**Match's Profile (in chat or full profile):**
- Only shows if user has enabled sharing
- Same layout as own profile
- "Active today" badge in discovery cards

**FR-5.1.6 Sync Schedule**
- Manual sync: User taps "Sync Now"
- Auto sync: Every 30 minutes when app is active
- Background sync: Once per day at midnight (iOS background fetch, Android WorkManager)

**Acceptance Criteria:**
- [ ] Apple Health integration requests correct permissions
- [ ] Google Fit integration works on Android
- [ ] Strava OAuth flow completes successfully
- [ ] Today's stats fetch and display correctly
- [ ] Activity shows on profile when sharing enabled
- [ ] Sync updates data within 1 minute
- [ ] Tokens refresh automatically when expired

---

## Epic 6: Safety & Trust

### 5.14 Photo Verification

**Priority:** P1 (Should Have)

**User Story:**
_As a user, I want to verify my profile to build trust and stand out as a real, legitimate person._

**Requirements:**

**FR-6.1.1 Verification Flow**

1. User taps "Verify Your Profile" in settings or profile
2. Instructions screen:
   * Headline: "Let's Verify You're Real"
   * Instructions:
     - Take a selfie matching the pose shown
     - Make sure your face is clearly visible
     - No sunglasses or hats
     - Good lighting
   * Example poses: Smile, Neutral, Peace sign, Thumbs up
   * "Start Verification" button

3. Camera screen:
   * Random pose selected: "Please smile"
   * Face outline overlay (guide user to position face)
   * Capture button
   * Retake button

4. Processing:
   * Upload photo to Cloud Storage (temporary)
   * Call Cloud Function: `verifyProfilePhoto`
   * Show loading: "Verifying your photo..."

5. Result:
   * **Success:**
     - Confetti animation
     - "You're Verified!" headline
     - Blue checkmark badge
     - Update Firestore: `photoVerified = true`
     - Delete temporary photo
     - Award verified badge on profile
   
   * **Failure:**
     - Error message with reason:
       * "Face not detected clearly"
       * "Photo doesn't match your profile"
       * "Please remove sunglasses/hat"
       * "Lighting too dark"
     - "Try Again" button
     - Max 3 attempts per day

**FR-6.1.2 Verification Algorithm (Cloud Function)**

```typescript
export const verifyProfilePhoto = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
    
    const { selfieUrl, userId } = data;
    
    // Get user's primary profile photo
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    const profilePhotoUrl = userDoc.data()?.photos[0];
    
    if (!profilePhotoUrl) {
      throw new functions.https.HttpsError('failed-precondition', 'No profile photo found');
    }
    
    // Use Google Cloud Vision API for face detection
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();
    
    // Detect faces in selfie
    const [selfieResult] = await client.faceDetection(selfieUrl);
    const selfiFaces = selfieResult.faceAnnotations;
    
    if (!selfieFaces || selfieFaces.length === 0) {
      return { verified: false, reason: 'No face detected in selfie' };
    }
    
    if (selfieFaces.length > 1) {
      return { verified: false, reason: 'Multiple faces detected. Please take a solo selfie' };
    }
    
    const selfieFace = selfieFaces[0];
    
    // Check liveness (anti-spoofing)
    if (selfieFace.detectionConfidence < 0.8) {
      return { verified: false, reason: 'Face not detected clearly. Ensure good lighting' };
    }
    
    // Detect faces in profile photo
    const [profileResult] = await client.faceDetection(profilePhotoUrl);
    const profileFaces = profileResult.faceAnnotations;
    
    if (!profileFaces || profileFaces.length === 0) {
      return { verified: false, reason: 'Cannot detect face in profile photo' };
    }
    
    const profileFace = profileFaces[0];
    
    // Compare facial landmarks (simplified - use ML model for production)
    const compareConfidence = compareFaces(selfieFace, profileFace);
    
    if (compareConfidence < 0.7) {
      return { verified: false, reason: 'Selfie doesn't match your profile photo' };
    }
    
    // Update user as verified
    await admin.firestore().doc(`users/${userId}`).update({
      photoVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Delete temporary selfie
    await admin.storage().bucket().file(selfieUrl).delete();
    
    return { verified: true };
  });

function compareFaces(face1, face2) {
  // Compare facial landmarks (eyes, nose, mouth positions)
  // This is simplified - use proper ML model in production
  const landmarks1 = face1.landmarks;
  const landmarks2 = face2.landmarks;
  
  // Calculate similarity score (0-1)
  let score = 0.8; // Base score
  
  // Adjust based on facial features matching
  // (Implement proper landmark comparison)
  
  return score;
}
```

**FR-6.1.3 Verified Badge Display**
- Blue checkmark icon next to name
- Appears in:
  * Discovery cards
  * Full profile modal
  * Chat header
  * Matches grid
- Tooltip on tap: "Verified profile"

**FR-6.1.4 Re-verification**
- If user changes primary photo significantly:
  * Remove verified status
  * Prompt to re-verify
  * "Your verification badge was removed because you changed your primary photo"

**Acceptance Criteria:**
- [ ] Camera captures clear selfie with face detection overlay
- [ ] Verification completes within 10 seconds
- [ ] Success rate >80% for legitimate users
- [ ] False positive rate <5%
- [ ] Verified badge displays correctly across app
- [ ] Failed verifications provide helpful error messages

---

### 5.15 Reporting & Moderation

**Priority:** P0 (Must Have)

**User Story:**
_As a user, I want to report inappropriate behavior so the community remains safe and respectful._

**Requirements:**

**FR-6.2.1 Report Flow**

**Where to Report:**
- From chat menu (3 dots)
- From full profile modal (flag icon)
- From matches list (long press → Report)

**Report Modal:**
1. Headline: "Report {Name}"
2. Categories (radio buttons):
   * Inappropriate Photos
   * Harassment or Bullying
   * Spam or Scam
   * Fake Profile
   * Underage User
   * Solicitation
   * Other

3. Description (optional textarea):
   * "Tell us what happened..." placeholder
   * Max 500 characters

4. Submit button: "Submit Report"
5. Cancel button

**FR-6.2.2 Report Submission**

```typescript
const submitReport = async (reportedUserId: string, category: string, description?: string) => {
  const reportData = {
    reporterId: userId,
    reportedUserId,
    category,
    description: description || '',
    reportedAt: serverTimestamp(),
    status: 'pending',
    platform: Platform.OS,
    appVersion: Constants.expoConfig.version,
  };
  
  // Save to Firestore
  await addDoc(collection(db, 'reports'), reportData);
  
  // Check for auto-ban threshold (Cloud Function)
  // If user has 3+ reports in 24h → Auto-ban
  
  // Show success message
  Alert.alert(
    'Report Submitted',
    'Thank you for helping keep fitlink safe. We'll review this report promptly.',
    [{ text: 'OK' }]
  );
  
  // Optional: Unmatch and block reporter
  Alert.alert(
    'Unmatch This User?',
    'Would you also like to unmatch and block this user?',
    [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => blockUser(reportedUserId) },
    ]
  );
};
```

**FR-6.2.3 Auto-Ban Logic (Cloud Function)**

```typescript
export const checkReportThreshold = functions
  .firestore.document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const reportedUserId = report.reportedUserId;
    
    // Get reports in last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentReports = await admin.firestore()
      .collection('reports')
      .where('reportedUserId', '==', reportedUserId)
      .where('reportedAt', '>=', admin.firestore.Timestamp.fromMillis(oneDayAgo))
      .get();
    
    if (recentReports.size >= 3) {
      // Auto-ban user
      await admin.firestore().doc(`users/${reportedUserId}`).update({
        banned: true,
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        banReason: 'Multiple reports in 24 hours',
      });
      
      // Sign out user (revoke refresh tokens)
      await admin.auth().revokeRefreshTokens(reportedUserId);
      
      // Send email notification
      const userDoc = await admin.firestore().doc(`users/${reportedUserId}`).get();
      const email = userDoc.data()?.email;
      
      if (email) {
        // Send ban notification email
        // (Implement email service - SendGrid, etc.)
      }
      
      // Flag for admin review
      await admin.firestore().collection('admin_queue').add({
        type: 'auto_ban',
        userId: reportedUserId,
        reportCount: recentReports.size,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
```

**FR-6.2.4 Blocking Users**

**Block Flow:**
1. User selects "Block" from menu
2. Confirmation: "Block {Name}? They won't be able to message you or see your profile."
3. If confirmed:
   * Add to `/blocked/{userId}/{blockedUserId}`
   * Remove existing match (if any)
   * Hide from discovery permanently
   * Cannot message
   * Cannot re-match

**Unblock:**
- Settings → Privacy → Blocked Users
- List of blocked users with photos
- Tap "Unblock" button
- Confirmation required

**FR-6.2.5 Content Moderation**

**Photo Upload Moderation (Cloud Function):**
```typescript
export const moderatePhoto = functions
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    
    // Only moderate profile photos
    if (!filePath.includes('/photos/')) return;
    
    // Use Google Cloud Vision Safe Search
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();
    
    const [result] = await client.safeSearchDetection(`gs://${object.bucket}/${filePath}`);
    const safeSearch = result.safeSearchAnnotation;
    
    // Check for inappropriate content
    const isInappropriate = 
      safeSearch.adult === 'VERY_LIKELY' ||
      safeSearch.violence === 'VERY_LIKELY' ||
      safeSearch.racy === 'VERY_LIKELY';
    
    if (isInappropriate) {
      // Flag for review
      const userId = filePath.split('/')[1];
      
      await admin.firestore().collection('flags').add({
        userId,
        photoUrl: `gs://${object.bucket}/${filePath}`,
        reason: 'Inappropriate content detected',
        safeSearch,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // Delete photo
      await admin.storage().bucket(object.bucket).file(filePath).delete();
      
      // Notify user
      await admin.firestore().doc(`users/${userId}`).update({
        photoRejected: true,
        photoRejectionReason: 'Photo violates community guidelines',
      });
    }
  });
```

**Bio Moderation:**
- Cloud Function on user update
- Check for:
  * Phone numbers (regex)
  * Email addresses
  * URLs/links
  * Explicit keywords
  * Spam patterns
- If flagged:
  * Reject update
  * Add to review queue
  * Notify user: "Bio contains prohibited content"

**FR-6.2.6 Admin Moderation Dashboard** (Future Phase)
- Web dashboard for admin review
- Queue of reports, flags, banned users
- Actions: Ban, Warn, Dismiss
- Evidence: Screenshots, chat history
- Notes field for decisions

**Acceptance Criteria:**
- [ ] Users can report from chat and profile
- [ ] Report submissions save to Firestore
- [ ] Auto-ban triggers at 3 reports/24h
- [ ] Blocked users cannot message or see profile
- [ ] Photo moderation rejects inappropriate content
- [ ] Bio moderation flags prohibited content

---

### 5.16 Safety Resources

**Priority:** P1 (Should Have)

**User Story:**
_As a user, I want access to safety tips and resources so I can date safely and responsibly._

**Requirements:**

**FR-6.3.1 Safety Center Screen**

**Sections:**

1. **Safety Tips**
   - Icon header: Shield with checkmark
   - Tips list (expandable cards):
     * "Meet in Public Places"
       - First dates should always be in public
       - Tell a friend where you're going
       - Have your own transportation
     
     * "Protect Your Personal Information"
       - Don't share your address or workplace early
       - Keep conversations in-app initially
       - Be cautious with social media links
     
     * "Trust Your Instincts"
       - If something feels off, it probably is
       - Don't feel pressured to meet or continue conversation
       - Block and report suspicious behavior
     
     * "Watch for Red Flags"
       - Asks for money or financial help
       - Pressures you to leave the platform quickly
       - Inconsistent stories or vague answers
       - Refuses video calls before meeting
     
     * "Stay Sober and Alert"
       - Don't leave your drink unattended
       - Watch your alcohol intake on first dates
       - Stay aware of your surroundings

2. **Community Guidelines**
   - Link to full guidelines (web view)
   - Key points:
     * Be respectful and kind
     * No harassment or hate speech
     * No explicit or sexual content
     * No spam or solicitation
     * Be yourself (no fake profiles)

3. **Quick Actions**
   - Report a User button
   - Block a User button
   - Contact Support button

4. **Emergency Resources** (Localized by country)
   **Malaysia:**
   - Police: 999
   - Women's Aid Organization: 03-3000 8858
   - Talian Kasih (Women & Children): 15999
   
   **Singapore:**
   - Police: 999
   - AWARE Sexual Assault Care Centre: 6779 0282
   
   **Thailand:**
   - Tourist Police: 1155
   - Women and Men Progressive Movement: 02-513-1001
   
   (Add for other countries)

5. **Resources Links**
   - Dating Safety Guide (web view)
   - Recognizing Scams (web view)
   - Sexual Consent (web view)
   - Mental Health Support (web view)

**FR-6.3.2 In-App Safety Prompts**

**First Match Notification:**
- Modal appears before first chat
- "Stay Safe While Dating"
- Key safety tips (condensed)
- "I Understand" button to proceed
- Don't show again checkbox

**Before First Date:**
- If users mention meeting in chat (ML detection):
  * "Planning to meet? Stay safe!"
  * Link to safety tips
  * Reminder to tell a friend

**FR-6.3.3 Safety Resources Access**
- Link in Settings → Safety Center
- Link at bottom of chat screens
- Link in report flow
- Push notification campaigns (quarterly): "Stay Safe: Dating Tips"

**Acceptance Criteria:**
- [ ] Safety Center displays all sections
- [ ] Tips are clear and actionable
- [ ] Emergency numbers correct for each country
- [ ] First match safety prompt shows once
- [ ] Safety links accessible from multiple places

---

## Epic 7: Localization & SEA Market Fit

### 5.17 Multi-Language Support

**Priority:** P0 (Must Have)

**User Story:**
_As a user in SEA, I want to use the app in my preferred language so I can understand everything clearly._

**Requirements:**

**FR-7.1.1 Supported Languages**
1. English (en) - Primary
2. Bahasa Melayu (ms) - Malaysia, Indonesia, Brunei
3. Simplified Chinese (zh) - Malaysia, Singapore
4. Tamil (ta) - Malaysia, Singapore

**FR-7.1.2 Translation Coverage**

**Must be translated:**
- All UI text (buttons, labels, placeholders)
- Navigation titles
- Form validation errors
- Toast messages
- Alert dialogs
- Empty states
- Onboarding screens
- Settings screens
- Error messages
- Push notifications

**Context-specific translations:**
- Fitness activities (localized names)
- Dietary preferences
- Height units (cm standard in SEA)
- Date formats (DD/MM/YYYY)
- Currency symbols

**DO NOT translate:**
- User-generated content (bios, messages)
- Names
- Locations (city names stay in local language)
- Brand name "fitlink"

**FR-7.1.3 i18n Implementation**

**Setup (i18next):**
```typescript
// src/locales/i18n.config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './en/translation.json';
import ms from './ms/translation.json';
import zh from './zh/translation.json';
import ta from './ta/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ms: { translation: ms },
      zh: { translation: zh },
      ta: { translation: ta },
    },
    lng: Localization.locale.split('-')[0], // Auto-detect device language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

**Usage:**
```typescript
import { useTranslation } from 'react-i18next';

const WelcomeScreen = () => {
  const { t } = useTranslation();
  
  return (
    <Text>{t('welcome.headline')}</Text>
    <Button title={t('welcome.get_started')} />
  );
};
```

**Translation Files:**
```json
// src/locales/en/translation.json
{
  "welcome": {
    "headline": "Find Your Fitness Match",
    "tagline": "Connect with active singles in Malaysia & SEA",
    "get_started": "Get Started"
  },
  "onboarding": {
    "step1": {
      "title": "Tell Us About You",
      "first_name": "First Name",
      "date_of_birth": "Date of Birth"
    }
  },
  "discovery": {
    "no_more_profiles": "No more profiles nearby",
    "refresh": "Refresh"
  },
  "errors": {
    "network": "Network error. Please check your connection.",
    "generic": "Something went wrong. Please try again."
  }
}
```

**FR-7.1.4 Language Selector**
- In onboarding: Auto-detect, allow manual selection
- In settings: Dropdown with language names and flags
  * English 🇬🇧
  * Bahasa Melayu 🇲🇾
  * 中文 🇨🇳
  * தமிழ் 🇮🇳
- Changes apply immediately (no restart)
- Save to Firestore: `users/{userId}/language`

**FR-7.1.5 RTL Support (Future)**
- Prepare for Arabic/Urdu if expanding to Middle East
- Use I18nManager.isRTL for layouts
- Mirror UI elements for RTL languages

**FR-7.1.6 Translation Quality**
- Native speakers review all translations
- Cultural appropriateness checked
- Fitness terminology accurate
- Tone matches brand (friendly, motivational)

**Acceptance Criteria:**
- [ ] All 4 languages fully translated
- [ ] Language selection works in onboarding and settings
- [ ] Changes apply immediately without restart
- [ ] No English fallbacks visible to users
- [ ] Date/time formats correct per locale
- [ ] Translations reviewed by native speakers

---

### 5.18 Cultural Adaptations

**Priority:** P0 (Must Have)

**User Story:**
_As a user in SEA, I want the app to respect my cultural values and preferences so I feel comfortable using it._

**Requirements:**

**FR-7.2.1 Religion Field**

**Importance:**
- Religion is significant in Malaysia and SEA for dating compatibility
- Many users filter by religion (esp. Muslim, Hindu communities)
- Must be handled sensitively

**Implementation:**
- Optional field in onboarding (Step 5)
- Options:
  * Islam
  * Buddhism
  * Christianity
  * Hinduism
  * Sikhism
  * No preference
  * Prefer not to say
- Display on profile (About section)
- Premium filter option (search by religion)

**FR-7.2.2 Halal Dietary Option**

**Special Handling:**
- "Halal" is both dietary and religious preference
- Highlight in lifestyle section with 🕌 icon
- Show badge on profile cards if selected
- Important for Muslim users in Malaysia (60% of population)

**FR-7.2.3 Modest Photo Guidelines**

**SEA-Specific:**
- Allow hijabs, religious attire in photos
- Don't flag modest clothing as "face obscured"
- Photo verification works with hijabs (face detection on visible parts)
- Guidelines respect cultural dress codes

**FR-7.2.4 Gender & Pronoun Sensitivity**

**Conservative Markets:**
- Gender options: Male, Female, Non-binary (optional)
- Don't force pronouns (not common in SEA languages)
- Respect traditional gender preferences
- Allow "Everyone" in gender preference for inclusivity

**FR-7.2.5 Date Format & Units**

**Standards in SEA:**
- Date: DD/MM/YYYY (not MM/DD/YYYY)
- Time: 24-hour format (but show both as option)
- Height: Centimeters (not feet/inches)
- Distance: Kilometers (not miles)
- Weight: Kilograms (not pounds)
- Temperature: Celsius (not Fahrenheit)

**FR-7.2.6 Holidays & Events**

**Localized Content:**
- Malaysian holidays: Hari Raya, Chinese New Year, Deepavali, Christmas
- Singapore: Same as Malaysia
- Thailand: Songkran, Loy Krathong
- Philippines: Christmas season (Sept-Jan)
- Indonesia: Ramadan, Lebaran
- Vietnam: Tết (Lunar New Year)

**Marketing campaigns:**
- "Find Your Raya Match" (Malaysia, during Ramadan)
- "New Year, New Connections" (Chinese New Year)
- Festive app themes/icons

**FR-7.2.7 Payment Methods (Localized)**

**Malaysia:**
- FPX (online banking) - most popular
- Credit/debit cards
- GrabPay
- Touch 'n Go eWallet

**Singapore:**
- Credit/debit cards
- PayNow
- GrabPay

**Thailand:**
- Credit/debit cards
- PromptPay
- TrueMoney Wallet

**Philippines:**
- Credit/debit cards
- GCash (very popular)
- PayMaya

**Indonesia:**
- Credit/debit cards
- OVO
- GoPay
- DANA

**Vietnam:**
- Credit/debit cards
- MoMo
- ZaloPay

**FR-7.2.8 Customer Support Localization**

**Support Channels:**
- Email: support@fitlink.app
- Response languages: English, Malay
- FAQ in all 4 languages
- Local phone support (future): Malaysia +60, Singapore +65

**FR-7.2.9 Marketing & Messaging**

**Tone:**
- Respectful and conservative (avoid overtly sexual)
- Family-friendly language
- Emphasis on "finding meaningful connections"
- Fitness as healthy lifestyle (not vanity)

**Imagery:**
- Diverse representation (Malay, Chinese, Indian, other ethnicities)
- Modest workout attire in marketing
- Hijabs included in user representations
- Real SEA locations (KLCC, Marina Bay, Bangkok temples)

**Acceptance Criteria:**
- [ ] Religion field optional and respectful
- [ ] Halal option prominent for Muslim users
- [ ] Photo verification works with hijabs/modest dress
- [ ] Date formats and units correct for SEA
- [ ] Payment methods include local options
- [ ] Marketing imagery culturally appropriate
- [ ] Support available in English and Malay

---

## 6. Non-Functional Requirements

### 6.1 Performance

**NFR-1: App Launch Time**
- Cold start: <3 seconds on mid-range devices
- Warm start: <1 second

**NFR-2: Screen Load Times**
- Discovery stack: <2 seconds
- Chat messages: <1 second
- Profile: <1 second

**NFR-3: Animation Performance**
- Maintain 60fps for swipe animations
- No jank on scrolling (chat, matches list)

**NFR-4: Image Loading**
- Progressive loading (blur-up)
- Lazy loading in lists
- Cache hit rate >80%

**NFR-5: Offline Functionality**
- Cache user profile locally
- Queue messages when offline, send when online
- Show cached content while loading

### 6.2 Scalability

**NFR-6: User Growth**
- Support 100,000 concurrent users
- Firestore queries optimized with indexes
- Cloud Functions scale automatically

**NFR-7: Message Throughput**
- Handle 10,000 messages per minute
- Real-time delivery <1 second

**NFR-8: Storage**
- Photos compressed to <2MB each
- Thumbnails generated (150x150, 400x400)
- Storage costs <$0.10 per user per month

### 6.3 Security

**NFR-9: Data Encryption**
- All data in transit encrypted (HTTPS, WSS)
- Sensitive data at rest encrypted (Strava tokens)
- Firestore security rules enforced

**NFR-10: Authentication**
- OAuth 2.0 for social login
- JWT tokens with expiration
- Biometric auth option

**NFR-11: Privacy**
- PDPA compliant (Malaysia Personal Data Protection Act)
- GDPR ready (future EU expansion)
- User data export feature
- Account deletion removes all data

**NFR-12: Rate Limiting**
- API calls: 100 requests per minute per user
- Login attempts: 5 per hour
- Reports: 5 per day per user

### 6.4 Reliability

**NFR-13: Uptime**
- 99.9% uptime target (43 minutes downtime per month)
- Firebase SLA: 99.95%

**NFR-14: Error Handling**
- All errors logged to Firebase Crashlytics
- Graceful degradation (offline mode)
- User-friendly error messages

**NFR-15: Data Backup**
- Firestore automatic backups daily
- Point-in-time recovery

### 6.5 Compliance

**NFR-16: Age Restriction**
- 18+ only, enforced via date of birth
- App Store/Play Store age rating: 17+

**NFR-17: Content Policy**
- No explicit content
- Moderation via Google Cloud Vision
- User reporting system

**NFR-18: Legal**
- Terms of Service
- Privacy Policy
- Cookie Policy
- Refund Policy (for subscriptions)

---

## 7. Technical Specifications

### 7.1 Firestore Schema

The canonical schema lives in `ARCHITECT.md`. This section reproduces it here for PRD completeness.

#### `/users/{userId}`
```typescript
{
  uid: string;
  firstName: string;
  dateOfBirth: Timestamp;
  age: number;                     // calculated server-side in onUserCreated — never trust client
  gender: 'male' | 'female' | 'non-binary';
  location: { city: string; country: string; coordinates: GeoPoint };
  photos: string[];                // Cloud Storage URLs, index 0 = primary photo
  bio: string;                     // 50–500 chars
  height: number;                  // cm
  religion?: string;
  activities: string[];
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
  workoutFrequency: string;
  dietaryPreference: string;
  fitnessGoals: string[];
  smoking: 'yes' | 'no' | 'occasionally';
  drinking: 'yes' | 'no' | 'socially';
  lookingFor: Array<'friends' | 'workout_partners' | 'dating'>;
  preferences: {
    ageRange: { min: number; max: number };
    distanceKm: number;
    genders: string[];
  };
  stats: { likes: number; passes: number; matches: number };
  subscription: { tier: 'free' | 'premium'; expiresAt?: Timestamp };
  verified: boolean;
  paused: boolean;                 // true = hidden from discovery (user-toggled in Settings)
  banned: boolean;                 // true = platform ban, all activity blocked
  expoPushToken?: string;          // saved on first notification permission grant
  language: string;
  createdAt: Timestamp;
  lastActive: Timestamp;
}
```

#### `/swipes/{userId}/likes/{targetUserId}`
```typescript
{
  swiperId: string;
  targetId: string;
  isSuperLike: boolean;
  createdAt: Timestamp;
}
```

#### `/swipes/{userId}/passes/{targetUserId}`
```typescript
{
  swiperId: string;
  targetId: string;
  createdAt: Timestamp;
}
```

> **Schema note:** Swipes use a subcollection structure. Never flatten to a top-level `/swipes/{swipeId}` collection — the `onSwipeCreated` Cloud Function trigger depends on this path.

#### `/users/{userId}/dailyLikes` (document)
```typescript
{
  count: number;
  resetAt: Timestamp;    // midnight in user's local timezone
}
```

#### `/matches/{matchId}`
```typescript
{
  users: [string, string];         // both userIds, sorted alphabetically
  createdAt: Timestamp;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  [userId + '_unread']: number;    // dynamic key per user
}
```

#### `/matches/{matchId}/messages/{messageId}`
```typescript
{
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'voice';
  readBy: string[];
  createdAt: Timestamp;
}
```

#### `/reports/{reportId}`
```typescript
{
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  createdAt: Timestamp;
  status: 'pending' | 'reviewed' | 'actioned';
}
```

### 7.2 Cloud Functions

**Functions List:**
1. `onUserCreated` - Trigger on new user, calculate age
2. `onSwipeCreated` - Detect mutual likes, create matches
3. `getDiscoveryStack` - Return scored potential matches
4. `verifyProfilePhoto` - Photo verification with ML
5. `createStripeCheckout` - Create Stripe subscription
6. `stripeWebhook` - Handle subscription events
7. `onNewMessage` - Send push notification
8. `moderatePhoto` - Content moderation on upload
9. `moderateBio` - Text content moderation
10. `checkReportThreshold` - Auto-ban logic
11. `exchangeStravaToken` - OAuth token exchange
12. `syncStravaActivity` - Fetch Strava activities

### 7.3 API Integrations

**Firebase:**
- Auth, Firestore, Storage, Cloud Functions, Realtime Database, Analytics

**Stripe:**
- Payment processing, subscription management
- Webhooks for events

**Strava:**
- OAuth 2.0
- Activities API

**Apple Health / Google Fit:**
- Native device APIs

**Google Cloud:**
- Vision API (photo verification, moderation)
- Places API (location autocomplete)

**Push Notifications:**
- Expo Push Notifications

### 7.4 Development Tools

**Code:**
- Cursor IDE with Claude Code/Codex
- Git for version control
- GitHub for repository

**Build:**
- EAS Build (Expo Application Services)
- EAS Submit (app store deployment)

**Testing:**
- Jest (unit tests)
- Detox (E2E tests)
- Firebase Test Lab (device testing)

**Monitoring:**
- Firebase Crashlytics
- Firebase Performance Monitoring
- Firebase Analytics
- Mixpanel (product analytics)

---

## 8. Milestones & Timeline

### Phase 1: MVP (Months 1-3)
**Features:**
- Authentication & Onboarding
- Discovery & Matching
- Chat & Matches
- Basic Profile
- Settings

**Deliverables:**
- iOS TestFlight beta
- Android internal testing
- 100 beta users in KL

### Phase 2: Growth (Months 4-6)
**Features:**
- Premium/Subscriptions
- Photo Verification
- Fitness Integrations
- Advanced Filters (premium)

**Deliverables:**
- Public App Store/Play Store launch
- Malaysia-wide marketing
- 10,000 users
- $5,000 MRR

### Phase 3: Expansion (Months 7-12)
**Features:**
- Video profiles
- Voice messages
- Events/meetups
- Gym check-ins

**Deliverables:**
- Launch in Singapore, Thailand
- 50,000 users across SEA
- $25,000 MRR

---

## 9. Success Metrics (KPIs)

### Acquisition
- App downloads
- Sign-up completion rate: >70%
- Onboarding completion rate: >60%

### Engagement
- DAU/MAU ratio: >20%
- Average session length: >5 minutes
- Sessions per week: >3

### Matching
- Swipe rate: >50 swipes per active user per session
- Match rate: 1-3% of swipes
- Message rate: >60% of matches send first message

### Monetization
- Free to premium conversion: >5%
- ARPU (Average Revenue Per User): >$2/month
- LTV: >$50
- CAC: <$10

### Retention
- D1 retention: >40%
- D7 retention: >20%
- D30 retention: >10%

---

## 10. Appendix

### 10.1 Glossary
- **Discovery**: Swiping interface to find potential matches
- **Stack**: Queue of profiles to swipe on
- **Super Like**: Premium action showing extra interest
- **Verified**: User completed photo verification
- **Premium**: Paid subscription tier

### 10.2 References
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [React Native / Expo Documentation](https://docs.expo.dev)
- [React Navigation Documentation](https://reactnavigation.org/docs/getting-started)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Strava API Documentation](https://developers.strava.com/docs/reference)
- Malaysia PDPA Guidelines: https://www.pdp.gov.my

---

**END OF PRD**

*This PRD is a living document and will be updated as features are built and requirements evolve.*