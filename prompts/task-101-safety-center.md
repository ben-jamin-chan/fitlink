# CODEX PROMPT — Task 101: Safety Center Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 89 must have extended `constants/regions.ts` with `Philippines`, `Indonesia`, `Vietnam` entries in `SUPPORTED_COUNTRIES`, `SEA_CITIES`, `COUNTRY_TIMEZONES`, `COUNTRY_CURRENCIES`, and `COUNTRY_CALLING_CODES` — verify all five exports are present and include all six countries
- Task 100 must have created `app/settings/BlockedUsersScreen.tsx` — verify the file exists
- Task 100 must have added `BlockedUsersScreen` to `app/navigation/MainTabNavigator.tsx` — verify the entry is present before modifying that file
- Task 100 must have added the Privacy → Blocked Users row in `app/settings/SettingsScreen.tsx` — verify it is present before modifying that file
- Task 99 must have added the Danger Zone → Delete Account row in `app/settings/SettingsScreen.tsx` — verify it is present before modifying that file

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: constants/regions.ts does not contain Philippines in SUPPORTED_COUNTRIES (Task 89).
  Cannot proceed. Re-run Task 89 before this task.
-->
```

---

## Context

- `constants/regions.ts` — `SUPPORTED_COUNTRIES`, `SEA_CITIES`, `COUNTRY_TIMEZONES`, `COUNTRY_CURRENCIES`, `COUNTRY_CALLING_CODES` all extended in Task 89 to include PH/ID/VN; `SupportedCountry` type covers all six countries
- `store/profileStore.ts` — `profile.location.country` holds the user's registered country as a `string` matching a `SupportedCountry` value; read-only in this task
- `app/settings/SettingsScreen.tsx` — last modified in Task 100 (added Privacy → Blocked Users row) and Task 99 (added Danger Zone → Delete Account row in red); both rows must be preserved exactly as-is
- `app/navigation/MainTabNavigator.tsx` — last modified in Task 100 (appended `BlockedUsersScreen` to Settings stack) and Task 99 (added `DeleteAccountScreen` title option); append only, never reorder
- `app/matches/MatchesScreen.tsx` — has a real-time Firestore listener for new matches; this task adds a one-time AsyncStorage-gated safety prompt to that listener's callback
- `store/matchStore.ts` — READ ONLY in this task; do not modify any store action or state shape
- `services/firebase/config.ts` — exports `functions` (region-pinned, added Task 97); do not re-create it
- `i18n/en.json` — already has `settings.blocked.*` (Task 100), `deleteAccount.*` (Task 99), `premium.restore.*` (Task 97); append `safety.*` keys, never remove or rename existing keys

**`app/settings/SettingsScreen.tsx` was modified in Tasks 99 and 100. Do not remove, reorder, or rewrite any existing section. The Safety Center row goes in the Support section only — above the existing "Help Center" row. The Danger Zone section (red Delete Account row, Task 99) and the Privacy section (Blocked Users row, Task 100) must remain completely unchanged.**

**`app/navigation/MainTabNavigator.tsx` was modified in Tasks 99 and 100. Append `SafetyCenterScreen` to the Settings stack only. Do not touch any other existing screen registration.**

**This task introduces no Cloud Functions, no Firestore writes, and no Zustand store mutations. All data flows are: Firestore reads (via `profileStore`, already in memory) and `AsyncStorage` reads/writes for the one-time prompt gate. Any write to a Zustand store in this task is architectural drift.**

---

## Task 101 — Safety Center Screen

**Files to create:**
- `constants/safetyResources.ts`
- `app/settings/SafetyCenterScreen.tsx`

**Files to modify:**
- `app/settings/SettingsScreen.tsx` — add Safety Center row to Support section only
- `app/navigation/MainTabNavigator.tsx` — append SafetyCenterScreen to Settings stack
- `app/matches/MatchesScreen.tsx` — add one-time first-match safety prompt gate
- `i18n/en.json` — append `safety.*` keys
- `i18n/my.json` — append `safety.*` keys (English placeholders)
- `i18n/zh.json` — append `safety.*` keys (English placeholders)
- `i18n/ta.json` — append `safety.*` keys (English placeholders)

---

### `constants/safetyResources.ts`

Emergency numbers and crisis lines for all six supported countries. Keyed by country string matching `SupportedCountry` values from `constants/regions.ts`.

```typescript
export interface EmergencyResource {
  police: string
  crisis?: string
  crisisName?: string
}

export const EMERGENCY_NUMBERS: Record<string, EmergencyResource> = {
  Malaysia: {
    police: '999',
    crisis: '15999',
    crisisName: 'Talian Kasih (Women & Children)',
  },
  Singapore: {
    police: '999',
    crisis: '6779 0282',
    crisisName: 'AWARE Sexual Assault Care Centre',
  },
  Thailand: {
    police: '1155',
    crisis: '02-513-1001',
    crisisName: 'Women and Men Progressive Movement',
  },
  Philippines: {
    police: '911',
    crisis: '1343',
    crisisName: 'DSWD Action Center',
  },
  Indonesia: {
    police: '110',
    crisis: '119',
    crisisName: 'Emergency Hotline',
  },
  Vietnam: {
    police: '113',
    crisis: '18001567',
    crisisName: 'National Domestic Violence Hotline',
  },
}

export const FALLBACK_COUNTRY = 'Malaysia'
```

---

### `app/settings/SafetyCenterScreen.tsx`

Default export screen. ScrollView layout with four sections: Safety Tips (expandable), Community Guidelines (static + external link), Quick Actions (two tappable rows), Emergency Resources (localised by country).

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useProfileStore } from '@/store/profileStore'
import { EMERGENCY_NUMBERS, FALLBACK_COUNTRY } from '@/constants/safetyResources'
import { colors, spacing, typography } from '@/constants/theme'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ------------------------------------------------------------
// Tip card — expandable with LayoutAnimation
// ------------------------------------------------------------

interface TipCardProps {
  titleKey: string
  bodyKey: string
}

const TipCard = ({ titleKey, bodyKey }: TipCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const handlePress = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((prev) => !prev)
  }

  return (
    <Pressable style={styles.tipCard} onPress={handlePress} accessibilityRole="button">
      <View style={styles.tipHeader}>
        <Text style={styles.tipTitle}>{t(titleKey)}</Text>
        <Text style={styles.tipChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={styles.tipBody}>{t(bodyKey)}</Text>
      )}
    </Pressable>
  )
}

// ------------------------------------------------------------
// Main screen
// ------------------------------------------------------------

const TIPS: Array<{ titleKey: string; bodyKey: string }> = [
  { titleKey: 'safety.tips.publicPlaces.title', bodyKey: 'safety.tips.publicPlaces.body' },
  { titleKey: 'safety.tips.personalInfo.title', bodyKey: 'safety.tips.personalInfo.body' },
  { titleKey: 'safety.tips.instincts.title',    bodyKey: 'safety.tips.instincts.body' },
  { titleKey: 'safety.tips.redFlags.title',      bodyKey: 'safety.tips.redFlags.body' },
  { titleKey: 'safety.tips.stayAlert.title',     bodyKey: 'safety.tips.stayAlert.body' },
]

export default function SafetyCenterScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const country = useProfileStore((s) => s.profile?.location?.country) ?? FALLBACK_COUNTRY
  const resource = EMERGENCY_NUMBERS[country] ?? EMERGENCY_NUMBERS[FALLBACK_COUNTRY]

  const handleGuidelinesLink = (): void => {
    void Linking.openURL('https://fitlink.app/guidelines')
  }

  const handleReportUser = (): void => {
    // Navigate to Matches tab — user selects match and reports from profile
    navigation.navigate('Matches' as never)
  }

  const handleContactSupport = (): void => {
    void Linking.openURL('mailto:support@fitlink.app')
  }

  const handlePhoneLink = (number: string): void => {
    // Strip spaces before dialling — tel: scheme requires no spaces on some Android versions
    void Linking.openURL(`tel:${number.replace(/\s/g, '')}`)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section 1: Safety Tips ── */}
      <Text style={styles.sectionHeader}>{t('safety.sections.tips')}</Text>
      {TIPS.map((tip) => (
        <TipCard key={tip.titleKey} titleKey={tip.titleKey} bodyKey={tip.bodyKey} />
      ))}

      {/* ── Section 2: Community Guidelines ── */}
      <Text style={styles.sectionHeader}>{t('safety.sections.guidelines')}</Text>
      <View style={styles.card}>
        <Text style={styles.guidelinesBody}>{t('safety.guidelines.body')}</Text>
        <Pressable onPress={handleGuidelinesLink} accessibilityRole="link">
          <Text style={styles.link}>{t('safety.guidelines.readFull')}</Text>
        </Pressable>
      </View>

      {/* ── Section 3: Quick Actions ── */}
      <Text style={styles.sectionHeader}>{t('safety.sections.quickActions')}</Text>
      <View style={styles.card}>
        <Pressable
          style={styles.actionRow}
          onPress={handleReportUser}
          accessibilityRole="button"
        >
          <Text style={styles.actionIcon}>🚩</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>{t('safety.actions.report.title')}</Text>
            <Text style={styles.actionSubtitle}>{t('safety.actions.report.subtitle')}</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.actionRow}
          onPress={handleContactSupport}
          accessibilityRole="button"
        >
          <Text style={styles.actionIcon}>✉️</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>{t('safety.actions.support.title')}</Text>
            <Text style={styles.actionSubtitle}>{t('safety.actions.support.subtitle')}</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>

      {/* ── Section 4: Emergency Resources ── */}
      <Text style={styles.sectionHeader}>{t('safety.sections.emergency')}</Text>
      <View style={styles.card}>
        {/* Police */}
        <Pressable
          style={styles.emergencyRow}
          onPress={() => handlePhoneLink(resource.police)}
          accessibilityRole="button"
          accessibilityLabel={`${t('safety.emergency.police')}: ${resource.police}`}
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <View style={styles.emergencyText}>
            <Text style={styles.emergencyLabel}>{t('safety.emergency.police')}</Text>
            <Text style={styles.emergencyNumber}>{resource.police}</Text>
          </View>
          <Text style={styles.phoneIcon}>📞</Text>
        </Pressable>

        {/* Crisis line — only if the country has one */}
        {resource.crisis != null && (
          <>
            <View style={styles.divider} />
            <Pressable
              style={styles.emergencyRow}
              onPress={() => handlePhoneLink(resource.crisis!)}
              accessibilityRole="button"
              accessibilityLabel={`${resource.crisisName}: ${resource.crisis}`}
            >
              <Text style={styles.emergencyIcon}>💙</Text>
              <View style={styles.emergencyText}>
                <Text style={styles.emergencyLabel}>{resource.crisisName}</Text>
                <Text style={styles.emergencyNumber}>{resource.crisis}</Text>
              </View>
              <Text style={styles.phoneIcon}>📞</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Bottom padding */}
      <View style={styles.bottomPad} />
    </ScrollView>
  )
}

// ------------------------------------------------------------
// Styles
// ------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  content: {
    padding: spacing.md,
  } as ViewStyle,
  sectionHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  } as TextStyle,

  // Tip card
  tipCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  } as ViewStyle,
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  tipTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    flex: 1,
  } as TextStyle,
  tipChevron: {
    fontSize: typography.sizes.xs,
    color: colors.gray[400],
    marginLeft: spacing.sm,
  } as TextStyle,
  tipBody: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    lineHeight: typography.sizes.sm * 1.6,
    marginTop: spacing.sm,
  } as TextStyle,

  // Generic card container
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  } as ViewStyle,

  // Guidelines
  guidelinesBody: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    lineHeight: typography.sizes.sm * 1.6,
    marginBottom: spacing.sm,
  } as TextStyle,
  link: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  } as TextStyle,

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  } as ViewStyle,
  actionIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  } as TextStyle,
  actionText: {
    flex: 1,
  } as ViewStyle,
  actionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
  } as TextStyle,
  actionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    marginTop: 2,
  } as TextStyle,
  actionChevron: {
    fontSize: typography.sizes.lg,
    color: colors.gray[400],
  } as TextStyle,

  // Emergency rows
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  } as ViewStyle,
  emergencyIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  } as TextStyle,
  emergencyText: {
    flex: 1,
  } as ViewStyle,
  emergencyLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
  } as TextStyle,
  emergencyNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginTop: 2,
  } as TextStyle,
  phoneIcon: {
    fontSize: 20,
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.xs,
  } as ViewStyle,

  bottomPad: {
    height: spacing.xl,
  } as ViewStyle,
})
```

---

### `app/settings/SettingsScreen.tsx` — Update

Add the Safety Center row to the **Support section only**. Do not modify any other section. The Danger Zone section (Delete Account, Task 99) and Privacy section (Blocked Users, Task 100) must remain completely unchanged.

```typescript
// Add import at the top with existing screen imports:
// (SafetyCenterScreen is already registered in the navigator — navigate by name)

// In the Support section, add this row ABOVE the existing "Help Center" row:
<SettingsRow
  label={t('safety.settingsRow')}
  icon="shield"
  onPress={() => navigation.navigate('SafetyCenter')}
/>
// Do not touch the Help Center row below it, or any other existing row.
```

---

### `app/navigation/MainTabNavigator.tsx` — Update

Append `SafetyCenterScreen` to the Settings stack. Do not touch any other existing screen registration.

```typescript
// Add import at the top alongside other Settings screen imports:
import SafetyCenterScreen from '@/app/settings/SafetyCenterScreen'

// Append to the Settings stack — after the existing BlockedUsersScreen entry from Task 100:
<Stack.Screen
  name="SafetyCenter"
  component={SafetyCenterScreen}
  options={{ title: t('safety.screenTitle') }}
/>
// Do not reorder or modify any existing Stack.Screen entries.
```

---

### `app/matches/MatchesScreen.tsx` — Update

Add the one-time first-match safety prompt gate. This fires once per device install — never again after the user dismisses it.

**Gate logic:** When the real-time matches listener delivers a non-empty matches array for the first time in the session, check `AsyncStorage.getItem('fitlink-safety-prompt-shown')`. If null, show the modal and set the key to `'true'` on dismiss. If `'true'`, skip silently.

```typescript
// Add imports at the top:
import React, { useState, useRef } from 'react'  // useRef if not already imported
import { Modal, Pressable } from 'react-native'   // Modal if not already imported
import AsyncStorage from '@react-native-async-storage/async-storage'

// Add state near the top of the component (do not use useState for matches data — only for this local UI gate):
const [safetyPromptVisible, setSafetyPromptVisible] = useState(false)
const safetyPromptChecked = useRef(false)  // prevents double-check within the same session

// Inside the existing matches listener callback, after the matches array is set into local/store state,
// add this check — only when matches.length > 0 and we haven't already checked this session:
const checkSafetyPrompt = async (): Promise<void> => {
  if (safetyPromptChecked.current) return
  safetyPromptChecked.current = true
  const shown = await AsyncStorage.getItem('fitlink-safety-prompt-shown')
  if (shown === null) {
    setSafetyPromptVisible(true)
  }
}
// Call: void checkSafetyPrompt() — inside the listener, gated on matches.length > 0

// Dismiss handler — sets AsyncStorage key so prompt never shows again:
const handleSafetyPromptDismiss = async (): Promise<void> => {
  await AsyncStorage.setItem('fitlink-safety-prompt-shown', 'true')
  setSafetyPromptVisible(false)
}

// Add the Modal at the bottom of the screen's return JSX (inside the outermost View, after the FlatList):
<Modal
  visible={safetyPromptVisible}
  transparent
  animationType="fade"
  onRequestClose={() => { void handleSafetyPromptDismiss() }}
>
  <View style={styles.promptOverlay}>
    <View style={styles.promptCard}>
      <Text style={styles.promptTitle}>{t('safety.prompt.title')}</Text>
      <Text style={styles.promptBody}>{t('safety.prompt.body')}</Text>
      <Pressable
        style={styles.promptButton}
        onPress={() => { void handleSafetyPromptDismiss() }}
        accessibilityRole="button"
      >
        <Text style={styles.promptButtonText}>{t('safety.prompt.cta')}</Text>
      </Pressable>
    </View>
  </View>
</Modal>

// Add to StyleSheet.create({}) — append only, do not touch existing styles:
promptOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: spacing.lg,
} as ViewStyle,
promptCard: {
  backgroundColor: colors.surface,
  borderRadius: 16,
  padding: spacing.xl,
  width: '100%',
} as ViewStyle,
promptTitle: {
  fontSize: typography.sizes.lg,
  fontWeight: typography.weights.bold,
  color: colors.gray[800],
  marginBottom: spacing.sm,
  textAlign: 'center',
} as TextStyle,
promptBody: {
  fontSize: typography.sizes.sm,
  color: colors.gray[600],
  lineHeight: typography.sizes.sm * 1.6,
  textAlign: 'center',
  marginBottom: spacing.lg,
} as TextStyle,
promptButton: {
  backgroundColor: colors.primary,
  borderRadius: 12,
  paddingVertical: spacing.md,
  alignItems: 'center',
} as ViewStyle,
promptButtonText: {
  fontSize: typography.sizes.md,
  fontWeight: typography.weights.semibold,
  color: colors.white,
} as TextStyle,
```

---

### i18n files — Update

Append the following keys to all four files. Use English values as placeholders in `my.json`, `zh.json`, and `ta.json`. Never remove or rename any existing key.

**`i18n/en.json`** — append under the root object:

```json
"safety": {
  "screenTitle": "Safety Center",
  "settingsRow": "Safety Center",
  "sections": {
    "tips": "Safety Tips",
    "guidelines": "Community Guidelines",
    "quickActions": "Quick Actions",
    "emergency": "Emergency Resources"
  },
  "tips": {
    "publicPlaces": {
      "title": "Meet in Public Places",
      "body": "Always meet someone new in a busy, public location. Let a friend or family member know where you're going and who you're meeting."
    },
    "personalInfo": {
      "title": "Protect Your Personal Information",
      "body": "Never share your home address, workplace, or financial information with someone you've just met online."
    },
    "instincts": {
      "title": "Trust Your Instincts",
      "body": "If something feels off, it probably is. It's okay to end a conversation or date if you feel uncomfortable — your safety comes first."
    },
    "redFlags": {
      "title": "Watch for Red Flags",
      "body": "Be cautious of anyone who asks for money, avoids video calls, or pressures you to move quickly. Report suspicious behaviour to us."
    },
    "stayAlert": {
      "title": "Stay Sober and Alert",
      "body": "Stay in control of your own drinks and transportation. Have a plan for getting home safely before you go out."
    }
  },
  "guidelines": {
    "body": "Our community is built on respect, honesty, and kindness. All members are expected to treat others with dignity and follow our community standards.",
    "readFull": "Read Full Community Guidelines"
  },
  "actions": {
    "report": {
      "title": "Report a User",
      "subtitle": "Report inappropriate behaviour from your matches"
    },
    "support": {
      "title": "Contact Support",
      "subtitle": "Reach our safety team at support@fitlink.app"
    }
  },
  "emergency": {
    "police": "Police / Emergency"
  },
  "prompt": {
    "title": "Your Safety Matters",
    "body": "Before you connect with your new match, take a moment to review our safety tips. Always meet in public, trust your instincts, and report anything that makes you uncomfortable.",
    "cta": "I Understand"
  }
}
```

**`i18n/my.json`**, **`i18n/zh.json`**, **`i18n/ta.json`** — append the identical `"safety": { ... }` block with English placeholder values. Do not translate — placeholder pattern per CONVENTIONS.md Section 8.

---

## Important Architecture Notes for Codex

1. **No store mutations in this task.** `store/matchStore.ts` is listed as read-only. `safetyPromptVisible` lives in `useState` local to `MatchesScreen.tsx` — this is appropriate because it is transient UI state (a modal gate). Do not add a Zustand action for this.

2. **AsyncStorage key discipline.** The key `'fitlink-safety-prompt-shown'` is new and unique to this task. Do not reuse any existing key. This key is NOT a background task key — it is read and written on the main JS thread within the component. No `TaskManager` interaction is needed.

3. **`LayoutAnimation` on Android requires the `UIManager` flag.** The `UIManager.setLayoutAnimationEnabledExperimental(true)` call must be at module scope (inside the `Platform.OS === 'android'` guard at the top of the file), not inside a `useEffect`. This is already shown in the scaffold above — do not move it.

4. **`SafetyCenterScreen` is a default export** (screen-level component, React Navigation requirement per CONVENTIONS.md Section 4). `TipCard` inside the same file is a named, non-exported component — this is correct.

5. **Emergency number phone links.** The `tel:` scheme does not support spaces on all Android versions. Strip all spaces from the number string before passing to `Linking.openURL`. This is already implemented in `handlePhoneLink` above.

6. **Country fallback.** `EMERGENCY_NUMBERS[country]` uses the user's `profile.location.country` string. If the profile is null or the country is not in the map, fall back to `EMERGENCY_NUMBERS[FALLBACK_COUNTRY]` (`'Malaysia'`). The optional chaining `?? FALLBACK_COUNTRY` pattern shown in the screen scaffold handles both cases.

7. **`SettingsScreen.tsx` preservation.** Three prior tasks have each added to this file (Task 97: Restore Purchases navigation; Task 99: Danger Zone → Delete Account; Task 100: Privacy → Blocked Users). Read the full file before modifying it. Add only the `SafetyCenter` navigation row to the Support section. Do not touch any other row or section.

8. **`MainTabNavigator.tsx` preservation.** Two prior tasks have each appended to the Settings stack (Task 99: `DeleteAccountScreen`; Task 100: `BlockedUsersScreen`). Append `SafetyCenterScreen` after the `BlockedUsersScreen` entry. Do not reorder existing entries.

9. **No new Firestore rules needed.** This task adds no new collections, subcollections, or server-only fields. `firestore.rules` is in the Do Not Touch list.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about a prior task's output that cannot be verified, OR
- Changing a schema field in a way that contradicts ARCHITECT.md

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing which file caused the conflict, what the error was, and what information is needed to proceed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced — search diff for `: any` and `as any`
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear anywhere in touched files
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/theme` — no hardcoded hex, px, or font sizes

**Firebase / Security**
- [ ] No server-only fields written from the client: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boostExpiresAt`
- [ ] No Cloud Functions called or added in this task
- [ ] `firestore.rules` not modified

**Architecture**
- [ ] `store/matchStore.ts` was not modified — verify with `git diff`
- [ ] `safetyPromptVisible` is `useState` local state, not a Zustand store field
- [ ] `AsyncStorage` key used is exactly `'fitlink-safety-prompt-shown'`
- [ ] `LayoutAnimation` Android flag set at module scope, not inside a hook or component body
- [ ] `UIManager.setLayoutAnimationEnabledExperimental` is inside `Platform.OS === 'android'` guard
- [ ] `SafetyCenterScreen` is a default export (screen-level); `TipCard` is a local named component
- [ ] Emergency number phone links strip spaces before dialling
- [ ] Country fallback to `'Malaysia'` is in place for null profile or unknown country

**Preservation checks**
- [ ] `app/settings/SettingsScreen.tsx`: Danger Zone section (Delete Account row, Task 99) still present and unchanged
- [ ] `app/settings/SettingsScreen.tsx`: Privacy section (Blocked Users row, Task 100) still present and unchanged
- [ ] `app/navigation/MainTabNavigator.tsx`: `DeleteAccountScreen` entry (Task 99) still present
- [ ] `app/navigation/MainTabNavigator.tsx`: `BlockedUsersScreen` entry (Task 100) still present

**Platform**
- [ ] Ask: "Would this break on Android?" — answer must be No (LayoutAnimation flag is set; tel: spaces stripped)
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `constants/safetyResources.ts` created and exports `EMERGENCY_NUMBERS` and `FALLBACK_COUNTRY` as named exports
- [ ] `EmergencyResource` interface exported from `constants/safetyResources.ts`
- [ ] `app/settings/SafetyCenterScreen.tsx` created as default export, renders all four sections
- [ ] All 5 safety tip cards expand and collapse individually on tap
- [ ] `LayoutAnimation` drives the expand/collapse — no `height: 0` toggle or `display: none` pattern
- [ ] Community Guidelines "Read Full Guidelines" link opens `https://fitlink.app/guidelines` in the browser
- [ ] "Report a User" navigates to the Matches tab
- [ ] "Contact Support" opens `mailto:support@fitlink.app`
- [ ] Emergency Resources section shows the correct police number for the user's registered country
- [ ] Emergency Resources shows the crisis line only if `resource.crisis` is defined for that country
- [ ] Tapping a phone number opens the dialler via `tel:` with spaces stripped from the number
- [ ] Unknown or null country falls back to Malaysia's numbers
- [ ] Settings → Support section has a "Safety Center" row above the existing "Help Center" row
- [ ] Tapping the Settings row navigates to `SafetyCenterScreen`
- [ ] `SafetyCenterScreen` is registered in the Settings stack navigator as `'SafetyCenter'`
- [ ] First-match safety prompt appears as a modal when the first match arrives and `'fitlink-safety-prompt-shown'` is null in AsyncStorage
- [ ] Tapping "I Understand" sets `'fitlink-safety-prompt-shown'` to `'true'` in AsyncStorage and dismisses the modal
- [ ] Re-launching the app (or triggering the listener again) does not show the prompt a second time
- [ ] `safety.*` keys present in all 4 i18n files; no existing keys removed or renamed
- [ ] `store/matchStore.ts` is unmodified — `git diff` shows no changes to this file
- [ ] `firestore.rules` is unmodified — `git diff` shows no changes to this file
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/matchStore.ts` (read-only this task — no mutations), `services/firebase/config.ts` (already exports `functions`; do not rewrite), `types/user.ts`, `constants/regions.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/src/index.ts`, any file under `admin/`

---

## Commit

```
git commit -m "task-101: add Safety Center screen with localised emergency resources and first-match prompt"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4D — Task 101] — YYYY-MM-DD

### Completed

- Task 101: Safety Center screen
- Added SafetyCenterScreen with 5 expandable safety tips, community guidelines link, report/support quick actions, and localised emergency numbers for all 6 supported countries
- Added one-time first-match safety prompt to MatchesScreen, gated by AsyncStorage key `'fitlink-safety-prompt-shown'`
- Wired Settings → Support → Safety Center navigation row
- Added `safety.*` translations to all four i18n files

### Files Created

- constants/safetyResources.ts: EMERGENCY_NUMBERS map and FALLBACK_COUNTRY for all 6 SEA countries
- app/settings/SafetyCenterScreen.tsx: scrollable safety center with expandable tip cards, guidelines, quick actions, and tel:-linked emergency numbers

### Files Modified

- app/settings/SettingsScreen.tsx: added Safety Center row to Support section above Help Center
- app/navigation/MainTabNavigator.tsx: appended SafetyCenterScreen to Settings stack as 'SafetyCenter'
- app/matches/MatchesScreen.tsx: added first-match safety prompt modal with AsyncStorage one-time gate
- i18n/en.json: appended safety.* keys
- i18n/my.json: appended safety.* keys (English placeholders)
- i18n/zh.json: appended safety.* keys (English placeholders)
- i18n/ta.json: appended safety.* keys (English placeholders)

### Architecture Decisions

- safetyPromptVisible is useState local state in MatchesScreen — not a Zustand store field. Transient UI gate with no cross-screen sharing requirement.
- AsyncStorage key 'fitlink-safety-prompt-shown' is checked on first non-empty match snapshot per session, guarded by a useRef to prevent double-check within the same session.
- EMERGENCY_NUMBERS keyed by plain string (not SupportedCountry type) to allow future country additions without a type change in safetyResources.ts.
- Country fallback to 'Malaysia' handles null profile and countries not yet in the map.

### Conflict Risks Introduced

- app/settings/SettingsScreen.tsx modified — any future task touching this file must preserve the Safety Center row in the Support section
- app/navigation/MainTabNavigator.tsx modified — any future task touching this file must preserve the SafetyCenter stack entry
- app/matches/MatchesScreen.tsx modified — Task 103+ unit tests should be aware of the AsyncStorage dependency in the listener callback if MatchesScreen is ever covered

### Known Issues / Deferred

- None

### Next Up

- Task 102: Jest Harness for Cloud Functions
```

Then return to claude.ai with the updated CHANGELOG.md and request the Task 102 prompt.
No additional files need to be attached unless `tsc` failed or Codex produced unexpected output.
