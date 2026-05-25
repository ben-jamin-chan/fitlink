# CODEX PROMPT — FORMAT REFERENCE
# This file is a formatting template only. It contains no real task logic.
# Use it as the structural reference when generating prompts for any task.

@CONVENTIONS.md @ARCHITECT.md

---

## Context

> Describe the current project state relevant to this task. List specific existing files Codex
> needs to know about, with a one-line note on what each provides. Be explicit about what is
> already built so Codex does not rebuild it.

Example entries:
- `store/exampleStore.ts` — `ExampleState` interface defined; `updateExample()` action available
- `components/ui/Button.tsx` — primary/outline/ghost variants; `loading` and `disabled` props
- `services/firebase/firestore.ts` — `createUserProfile()` already exported
- `i18n/en.json` — strings under `example.screen.*` already seeded

> If the task has an important architectural boundary — something Codex must NOT do — state it
> here in bold. This is the place to pre-empt the most common drift patterns.

Example: **Photos are stored as local URIs only in this task. Firebase Storage upload happens in
Task XX. If any upload code appears here, that is architectural drift and must be corrected.**

---

## Task XX — Short Descriptive Title

**Files to create:**
- `path/to/NewFile.tsx`
- `path/to/anotherNewFile.ts`

**Files to modify:**
- `path/to/ExistingFile.tsx` — one-line description of what changes

---

### `path/to/NewFile.tsx`

> Brief description of what this file does and how it is used by other parts of the codebase.
> Call out reuse expectations (e.g. "reusable by Task XX and Task YY").

```typescript
// Full implementation scaffold goes here.
// Include:
//   - All imports in the correct order per CONVENTIONS.md Section 5
//   - Props interface directly above the component
//   - Named export (not default, unless a screen)
//   - StyleSheet.create({}) at the bottom
//   - All style types annotated: ViewStyle, TextStyle, ImageStyle
//   - All user-facing strings through t()
//   - All colors/spacing/typography from constants/theme
//   - No inline styles
//   - No `any`
//   - No relative imports — use @/ alias

import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '@/constants/theme'

interface ExampleProps {
  value: string
  onPress: () => void
}

export const ExampleComponent = ({ value, onPress }: ExampleProps): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('example.screen.label')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  } as TextStyle,
})
```

---

### `path/to/anotherNewFile.ts`

> Description of this file's purpose.

```typescript
// Implementation here
```

---

### `path/to/ExistingFile.tsx` — Update

> Only show the specific change — not the full file. Describe what to add and what to remove.

```typescript
// Add import:
import { NewComponent } from '@/components/feature/NewComponent'

// Remove:
const PlaceholderComponent = (): React.JSX.Element => <View />

// The existing registration / usage stays the same:
// <Stack.Screen name="ExampleScreen" component={ExampleScreen} />
```

> If there are sections of the existing file that must not be touched, say so explicitly:
> "Do not touch the existing `handleSubmit` logic or the `StyleSheet` at the bottom."

---

## Important Architecture Notes for Codex

> Use numbered notes for constraints that are easy to miss or commonly violated.
> Each note should be one specific, actionable rule — not general advice.

1. **[Constraint name].** One sentence describing what must or must not happen, and why.
   Example: "No Firebase writes from this screen. All Firestore writes for this feature go
   through the `recordSwipe` Cloud Function (Task 55). Direct client writes will be blocked
   by security rules."

2. **[Pattern to use].** Describe the correct approach.
   Example: "Use `runOnJS()` for any JS-thread callback inside a Reanimated worklet. Never
   call `setState` or a Zustand action directly from `.onUpdate()` or `.onEnd()`."

3. **[Naming / constant rule].** Call out any specific values that must come from constants.
   Example: "`MIN_PHOTOS = 2` and `MAX_PHOTOS = 6` are imported from `constants/theme` —
   never hardcode these numbers."

---

## Acceptance Criteria

> Each item is a discrete, testable outcome. Write these so Codex can self-check before
> declaring the task done. Use checkbox format.

- [ ] `path/to/NewFile.tsx` created and exports `ExampleComponent` as a named export
- [ ] Props interface defined directly above component — not in a separate types file
- [ ] All user-facing strings use `t()` — no hardcoded English text in JSX
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` in JSX
- [ ] All colors/spacing/typography from `constants/theme` — no hardcoded values
- [ ] All imports use `@/` alias — no relative paths
- [ ] Navigation typed with `StackNavigationProp<ParamList, 'ScreenName'>`
- [ ] `tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

> List files that must remain completely unchanged. Be specific — vague lists cause Codex to
> skip files it should have left alone.

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`constants/`, `i18n/`, `firestore.rules`

---

## Commit

```
git commit -m "task-XX: short description matching CONVENTIONS.md Section 16 format"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase X.Y — Task XX] — YYYY-MM-DD

### Completed

- Task XX: [What was built — one line per major deliverable]
- [Component/file name]: [What it does]

### Files Created / Modified

- path/to/NewFile.tsx: [brief description of exports and purpose]
- path/to/ExistingFile.tsx: [brief description of what changed]

### Architecture Decisions

- [Any non-obvious choice made and why — future sessions need this context]

### Known Issues / Deferred

- [Anything intentionally left incomplete, with the task number where it will be resolved]

### Next Up

- Task XX+1: [Short description of next task]
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

> Set to one of: Low / Medium / High / Extra High
> - Low: straightforward UI wiring, no logic branching
> - Medium: moderate complexity, some state or async logic
> - High: audit tasks, security rules, schema migrations, Cloud Functions with transactions
> - Extra High: multi-file schema migrations touching many existing files simultaneously, Cloud Function + client + security rules changes that must land atomically, or tasks where an error in one file breaks the entire app (e.g. Task 47 type migration)

Medium
