# CODEX PROMPT — Tasks 04 & 05
# TypeScript Types + Theme System

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 0 scaffold is complete (Tasks 01–03 done). The project has:
- Expo project initialized with TypeScript strict mode
- All Phase 1 dependencies installed
- Folder structure created
- AGENTS.md in project root

The next two tasks establish the type system and theme tokens that every subsequent task depends on.
Complete them in order. Do not proceed to Task 06 in this session.

---

## Prerequisite — Configure Path Aliases

Before Task 04, configure the `@/` path alias. This is required by CONVENTIONS.md Section 2.
Every internal import in this project uses `@/` — never relative paths.

**Step 1 — Update `tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 2 — Install babel plugin:**
```bash
npm install --save-dev babel-plugin-module-resolver
```

**Step 3 — Update `babel.config.js`:**
```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: { '@': '.' }
      }],
      'react-native-reanimated/plugin'  // must be last
    ]
  }
}
```

**Step 4 — Verify:** `npx expo start` still boots without errors after this change.

Do not commit yet — commit after Task 04 completes.

---

## Task 04 — Create TypeScript Types

**Files to create:**
- `types/user.ts`
- `types/match.ts`
- `types/message.ts`
- `types/subscription.ts`

**Constraints:**
- Named exports only — no default exports from type files
- Use `Timestamp` from `firebase/firestore` for all date fields — never `Date` or `string`
- Use `interface` for object shapes, `type` for unions
- All fields must exactly match the Firestore schema in ARCHITECT.md

---

### `types/user.ts`

Define and export:

```typescript
import { Timestamp, GeoPoint } from 'firebase/firestore'

export type Gender = 'male' | 'female' | 'non-binary'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete'

export type LookingFor = 'friends' | 'workout_partners' | 'dating'

export type SmokingStatus = 'yes' | 'no' | 'occasionally'

export type DrinkingStatus = 'yes' | 'no' | 'socially'

export interface UserLocation {
  city: string
  country: string
  coordinates: GeoPoint
}

export interface UserPreferences {
  ageRange: { min: number; max: number }
  distanceKm: number
  genders: string[]
}

export interface UserStats {
  likes: number
  passes: number
  matches: number
}

export interface UserSubscription {
  tier: 'free' | 'premium'
  expiresAt?: Timestamp
}

export interface UserProfile {
  uid: string
  firstName: string
  dateOfBirth: Timestamp
  age: number                     // calculated server-side — never write from client
  gender: Gender
  location: UserLocation
  photos: string[]                // Cloud Storage URLs, index 0 = primary
  bio: string                     // 50–500 chars
  height: number                  // cm
  religion?: string
  activities: string[]
  fitnessLevel: FitnessLevel
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: SmokingStatus
  drinking: DrinkingStatus
  lookingFor: LookingFor[]
  preferences: UserPreferences
  stats: UserStats
  subscription: UserSubscription
  verified: boolean
  paused: boolean                 // true = hidden from discovery
  banned: boolean                 // true = platform ban
  expoPushToken?: string
  language: string
  createdAt: Timestamp
  lastActive: Timestamp
}

export interface DailyLikes {
  count: number
  resetAt: Timestamp
}
```

---

### `types/match.ts`

```typescript
import { Timestamp } from 'firebase/firestore'
import type { UserProfile } from '@/types/user'

export interface Match {
  id: string                      // matchId = users.sort().join('_')
  users: [string, string]         // both userIds, sorted alphabetically
  createdAt: Timestamp
  lastMessage?: string
  lastMessageAt?: Timestamp
  // Dynamic unread count keys: `${userId}_unread: number`
  [key: string]: unknown
}

export interface MatchWithProfile extends Match {
  otherUser: UserProfile          // the other user's full profile
}
```

---

### `types/message.ts`

```typescript
import { Timestamp } from 'firebase/firestore'

export type MessageType = 'text' | 'image' | 'voice'

export interface Message {
  id: string
  senderId: string
  text: string
  type: MessageType
  readBy: string[]
  createdAt: Timestamp
}
```

---

### `types/subscription.ts`

```typescript
import { Timestamp } from 'firebase/firestore'

export type SubscriptionTier = 'free' | 'premium'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export interface Subscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  expiresAt?: Timestamp
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}
```

---

**Acceptance criteria:**
- All 4 files created with exact field names matching ARCHITECT.md schema
- Zero TypeScript errors (`tsc --noEmit`)
- All exports are named exports
- `Timestamp` and `GeoPoint` imported from `firebase/firestore` only

**Do not touch:** `App.tsx`, `store/`, `services/`, `constants/`, any existing files

**Commit:** `git commit -m "task-04: create typescript types"`

---

## Task 05 — Set Up Theme System

**Files to create:**
- `constants/colors.ts`
- `constants/spacing.ts`
- `constants/typography.ts`
- `constants/theme.ts`

**Constraints:**
- Named exports only
- `as const` on every object so TypeScript infers literal types
- No values hardcoded anywhere else in the codebase — these files are the single source of truth
- `theme.ts` re-exports everything from the other three files as a single import point

---

### `constants/colors.ts`

```typescript
export const colors = {
  // Brand
  primary: '#4CAF50',        // green — like, success, active elements
  secondary: '#2196F3',      // blue — super like, verified badge, links
  danger: '#F44336',         // red — pass, delete, destructive actions
  warning: '#FFC107',        // yellow — rewind button, caution
  info: '#9C27B0',           // purple — profile info button

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Surfaces
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',

  // Status
  online: '#4CAF50',
  offline: '#BDBDBD',

  // Transparent
  transparent: 'transparent',
} as const

export type ColorKey = keyof typeof colors
```

---

### `constants/spacing.ts`

```typescript
// Base unit: 4px
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const MAX_PHOTOS = 6
export const MIN_PHOTOS = 2
export const MAX_BIO_LENGTH = 500
export const MIN_BIO_LENGTH = 50
export const DAILY_LIKE_LIMIT_FREE = 50
export const SWIPE_THRESHOLD_HORIZONTAL = 100  // px — triggers like/pass
export const SWIPE_THRESHOLD_VERTICAL = 100    // px — triggers super like
```

---

### `constants/typography.ts`

```typescript
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const
```

---

### `constants/theme.ts`

```typescript
// Single import point for all theme tokens.
// Usage: import { colors, spacing, typography, borderRadius } from '@/constants/theme'

export { colors } from '@/constants/colors'
export { spacing, borderRadius } from '@/constants/spacing'
export { typography } from '@/constants/typography'
export {
  MAX_PHOTOS,
  MIN_PHOTOS,
  MAX_BIO_LENGTH,
  MIN_BIO_LENGTH,
  DAILY_LIKE_LIMIT_FREE,
  SWIPE_THRESHOLD_HORIZONTAL,
  SWIPE_THRESHOLD_VERTICAL,
} from '@/constants/spacing'
```

---

**Acceptance criteria:**
- All 4 files created
- `import { colors, spacing, typography } from '@/constants/theme'` works in any file
- `tsc --noEmit` passes with zero errors
- `as const` used on all objects
- No hardcoded hex values or pixel numbers anywhere other than in these files

**Do not touch:** Any files from Task 04 or earlier

**Commit:** `git commit -m "task-05: set up theme system"`

---

## After This Session

Update CHANGELOG.md:
```
## [Phase 1.1] — [today's date]
### Completed
- Path alias configured (@/ → project root)
- Task 04: TypeScript types created (user, match, message, subscription)
- Task 05: Theme system created (colors, spacing, typography, theme re-export)

### Files Created / Modified
- tsconfig.json: added baseUrl and paths for @/ alias
- babel.config.js: added module-resolver plugin and reanimated plugin
- types/user.ts, types/match.ts, types/message.ts, types/subscription.ts
- constants/colors.ts, constants/spacing.ts, constants/typography.ts, constants/theme.ts

### Next Up
- Task 06: Firebase config setup
- Task 07: i18n setup
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry and ask for the Task 06–07 prompt.
