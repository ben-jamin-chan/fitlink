# CODEX PROMPT — Task 32
# Chat Screen — ChatScreen, MessageBubble, ChatInput

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 4.3 complete. Relevant existing files:

- `store/chatStore.ts` — `openChat(matchId, otherUserId)`, `closeChat()`, `sendMessage(text)`, `sendImage(uri)`, `onTypingStart()`, `markAsRead()`, `flushOfflineQueue()`. State: `messages: RTDBMessage[]`, `isTyping: boolean`, `isLoading: boolean`, `error: string | null`, `activeMatchId: string | null`
- `services/firebase/realtime.ts` — `subscribeToMessages`, `sendTextMessage`, `sendImageMessage`, `markMessagesAsRead`, `setTypingStatus`, `subscribeToTyping`, `registerPresence`, `setOffline`, `subscribeToPresence`
- `store/matchStore.ts` — `matches: MatchWithProfile[]`, `unmatch(matchId)`, `markAsRead(matchId)`. Use `matchStore` to resolve the other user's `UserProfile` from `matchId`.
- `store/authStore.ts` — `user.uid` for current user ID
- `store/profileStore.ts` — own user profile (for viewer-side shared interests)
- `services/firebase/storage.ts` — `uploadProfilePhoto` exists. **No new function needed here for Task 32** — chat image upload is handled inside `chatStore.sendImage` (see Confirmed Architecture below).
- `utils/imageUtils.ts` — `pickAndCompressImage(): Promise<string | null>`, `compressImage(uri): Promise<string>`
- `app/matches/MatchesScreen.tsx` — navigates to `Chat` screen passing `{ matchId: string }`
- `app/navigation/MainTabNavigator.tsx` — `MatchesNavigator` stack has `Chat` registered as placeholder
- `types/message.ts` — `RTDBMessage` type exported: `{ id: string; senderId: string; text: string | null; imageUrl: string | null; timestamp: number; read: boolean }`
- `types/match.ts` — `MatchWithProfile` type with other user's `UserProfile`
- `i18n/en.json` — `chat.*` keys already seeded: `chat.placeholder`, `chat.send`, `chat.typing`, `chat.imageAlt`, `chat.unmatch`, `chat.report`, `chat.viewProfile`, `chat.confirmUnmatch.title`, `chat.confirmUnmatch.message`, `chat.confirmUnmatch.confirm`, `chat.icebreaker.*`
- `constants/theme.ts` — all tokens: `colors`, `spacing`, `typography`, `borderRadius`
- `components/ui/LoadingOverlay.tsx` — `<LoadingOverlay visible={boolean} message?: string />`
- `components/ui/Toast.tsx` — `showToast(message, type)` global function
- `components/ui/Button.tsx` — standard Button component

### ⚠️ Confirmed Architecture — Read Before Writing Any Code

**`chatStore.sendImage` already handles the full image flow internally:** image picker, compression, Firebase Storage upload, download URL retrieval, and `sendImageMessage` to RTDB. Its signature is `sendImage(currentUserId, recipientId)`.

This means:
- **Do NOT add `uploadChatImage` to `services/firebase/storage.ts`** — that section is removed from this prompt.
- **Do NOT call `pickAndCompressImage` or any upload logic in `ChatScreen` or `ChatInput`** — the store owns this entirely.
- **`ChatInput.onSendImage` prop is not needed.** Instead, expose a single `onImagePress` callback (or none — see below).
- The image button in `ChatInput` should call `chatStore.sendImage(currentUserId, otherUserId)` directly, OR pass an `onImagePress` prop up to `ChatScreen` which calls it. Either is acceptable — choose whichever avoids prop drilling.
- `isUploading` state in `ChatScreen` should read from `chatStore.isLoading` (the store sets this during upload) rather than local state — unless the store exposes a separate `isUploading` flag. Check the store and use whatever flag covers the upload period.

Task 32 builds the full Chat UI. This is the most complex screen in Phase 1 — read every note carefully before writing any code.

---

## Task 32 — Chat Screen

**Files to create:**
- `components/chat/MessageBubble.tsx`
- `components/chat/ChatInput.tsx`
- `app/chat/ChatScreen.tsx`

**Files to modify:**
- `app/navigation/MainTabNavigator.tsx` — replace `Chat` placeholder with real `ChatScreen`
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add any missing `chat.*` keys

---

## 1. `components/chat/MessageBubble.tsx`

A single message row. Handles text messages, image messages, date headers, and system messages.

### Props interface

```typescript
interface MessageBubbleProps {
  message: RTDBMessage
  isMine: boolean           // true if message.senderId === current user's uid
  showTimestamp: boolean    // true every 5th message or on long press (handled by parent)
}
```

### Layout rules

**Sent messages (isMine === true):**
- Aligned to the right
- Background: `colors.primary` (#4CAF50)
- Text color: `colors.white`
- Border radius: 18px all corners, bottom-right corner flattened to 4px
- Max width: 75% of screen width

**Received messages (isMine === false):**
- Aligned to the left
- Background: `colors.gray[100]`
- Text color: `colors.gray[800]`
- Border radius: 18px all corners, bottom-left corner flattened to 4px
- Max width: 75% of screen width

**Image messages (`message.imageUrl !== null`):**
- Show `<Image>` thumbnail (max 200×200, `resizeMode="cover"`, border radius 12)
- Tap → call `onImagePress(imageUrl)` prop (fullscreen viewer handled by ChatScreen)
- Show a `colors.gray[400]` placeholder while loading (`onLoadStart` / `onLoadEnd`)

**Timestamp row (below bubble, only when `showTimestamp === true`):**
- Small gray text (typography.sizes.xs, colors.gray[400])
- Format: relative ("Just now", "5m ago", "2h ago") for today; "Jan 15 · 3:42 PM" for older
- For sent messages, also show read receipt icon (Ionicons):
  - `checkmark` (single) — sent
  - `checkmark-done` (double) — read (when `message.read === true`)
  - Color `colors.secondary` (#2196F3) when read, `colors.gray[400]` when not

### Additional props

```typescript
interface MessageBubbleProps {
  message: RTDBMessage
  isMine: boolean
  showTimestamp: boolean
  onImagePress: (url: string) => void
  onLongPress: (message: RTDBMessage) => void
}
```

### Constraints
- No inline styles
- Text content from `message.text` — render `null` if both `text` and `imageUrl` are null (guard)
- `useTranslation` for `chat.imageAlt` on image alt text (accessibility)

---

## 3. `components/chat/ChatInput.tsx`

The input bar fixed at the bottom of the chat screen.

### Props interface

```typescript
interface ChatInputProps {
  onSendText: (text: string) => void
  onImagePress: () => void          // triggers chatStore.sendImage — no URI arg needed, store owns picker
  onTyping: () => void              // called on every keystroke — chatStore.onTypingStart()
  disabled?: boolean                // true when chatStore.isLoading is true
}
```

### Layout

Horizontal row pinned to keyboard:
1. **Image button** (left): `Ionicons` `image-outline`, size 24, `colors.gray[600]`
   - `onPress` → call `onImagePress()` — the store handles picking, compressing, uploading
   - `disabled` when `disabled` prop is true (upload in progress)
2. **TextInput** (flex: 1, center):
   - `multiline`, `maxLength={1000}`
   - Auto-grows up to 4 lines, then scrolls internally (`scrollEnabled={true}`)
   - Placeholder: `t('chat.placeholder')`
   - `onChangeText`: update local state + call `onTyping()`
   - `returnKeyType="default"` (multiline, so Enter = newline not send)
3. **Send button** (right): `Ionicons` `send`, size 22
   - `colors.primary` when input non-empty; `colors.gray[300]` when empty
   - `disabled` when input empty or `disabled` prop true
   - `onPress` → call `onSendText(trimmed input)` + clear input

### Constraints
- Wrap entire component in `KeyboardAvoidingView` is handled by ChatScreen — ChatInput itself is just the row
- All text through `t()`
- No inline styles

---

## 4. `app/chat/ChatScreen.tsx`

The main conversation screen. This is the largest file in Task 32 — build it section by section.

### Navigation params

```typescript
// ChatScreen receives these from MatchesNavigator:
type ChatScreenParams = {
  matchId: string
}
```

Read with `useRoute<RouteProp<MatchesStackParamList, 'Chat'>>()`.

### Data wiring

```typescript
// Resolve from stores:
const { user } = useAuthStore()              // current user's uid
const { matches } = useMatchStore()          // find MatchWithProfile by matchId
const {
  messages,
  isTyping,
  isLoading,
  openChat,
  closeChat,
  sendMessage,
  sendImage,
  onTypingStart,
  markAsRead,
  flushOfflineQueue,
} = useChatStore()

// Derive other user's profile from matchStore:
const match = matches.find(m => m.id === matchId)
const otherUser = match?.profile   // UserProfile of the other person
```

On mount (`useEffect`):
1. `flushOfflineQueue()` — drain any pending messages from offline queue
2. `openChat(matchId, otherUser.uid)` — subscribe to RTDB messages, register presence
3. `markAsRead()` — reset unread count in Firestore match doc
4. Return cleanup: `closeChat()`

### Header

Use `navigation.setOptions()` inside `useEffect` to set a custom header:

```
Left:  Back button (Ionicons chevron-back, colors.gray[800])
Center: [CircularPhoto 40px tappable → stub for now] + Name + online status text
Right: 3-dot menu (Ionicons ellipsis-vertical) → opens action sheet
```

**Online status text:**
- Read from `subscribeToPresence` result stored in local state (`isOtherOnline: boolean`, `otherLastSeen: number | null`)
- "Active now" (colors.primary) if online
- "Active Xm ago" / "Active Xh ago" (colors.gray[500]) based on `otherLastSeen`
- No text if last seen > 24h ago

**Action sheet (3-dot menu)** — use `Alert.alert` with options array (cross-platform):
- "View Profile" → stub `Alert.alert('Coming soon')` (FullProfileModal integration deferred)
- "Unmatch" → confirmation → `matchStore.unmatch(matchId)` → navigate back
- "Report User" → stub `Alert.alert('Coming soon')` (reporting wired in Task 38)

**Unmatch confirmation:**
```
Alert.alert(
  t('chat.confirmUnmatch.title', { name: otherUser.firstName }),
  t('chat.confirmUnmatch.message'),
  [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('chat.confirmUnmatch.confirm'), style: 'destructive', onPress: handleUnmatch }
  ]
)
```

### Message list

Use `FlatList` inverted (`inverted={true}`) so newest messages appear at the bottom.

```typescript
<FlatList
  ref={flatListRef}
  data={[...messages].reverse()}   // reverse for inverted FlatList
  keyExtractor={(item) => item.id}
  renderItem={renderMessage}
  inverted
  onContentSizeChange={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false })}
  ListHeaderComponent={isTyping ? <TypingIndicator name={otherUser.firstName} /> : null}
  // ListHeader renders at the bottom visually (inverted)
/>
```

**`renderMessage`:** Determines `showTimestamp` — show every 5th message OR the first message. Pass `isMine`, `onImagePress`, `onLongPress` to `MessageBubble`.

**Date separators:** Group messages by calendar day. Between groups, insert a centered date label:
- "Today", "Yesterday", day name (Mon–Sun for this week), "Jan 15" for older
- Rendered as a non-interactive row in the FlatList data (tag items with `type: 'date-header' | 'message'`)

**Icebreaker suggestion (no messages yet):**
When `messages.length === 0` and `match` exists, show a horizontal scroll of icebreaker chips above the input area:
- Derive suggestions from shared activities between `user` and `otherUser`
- Examples (from PRD FR-2.3.3):
  - "Hey {name}! I see you're into {sharedActivity}. What's your favourite time to train?"
  - "Hi {name}! {sharedActivity} is my favourite too! How often do you go?"
  - "Hey {name}! Excited to match with you!"
- Tap chip → pre-fills `ChatInput` text field
- Store suggestion strings locally in the component (not i18n — they are dynamic)

### Typing indicator

```typescript
// Simple animated three-dot component rendered inline in FlatList header:
const TypingIndicator = ({ name }: { name: string }): React.JSX.Element => {
  // Animate 3 dots with staggered useSharedValue + useAnimatedStyle (bounce)
  // Text: t('chat.typing', { name })
}
```

Use Reanimated 3 `withRepeat` + `withSequence` + `withTiming` for the bounce. Each dot delays by 150ms.

### Image send flow

Because `chatStore.sendImage` owns the full image flow (picker → compress → upload → send), ChatScreen simply delegates to it:

```typescript
const handleImagePress = async (): Promise<void> => {
  // chatStore.sendImage handles: pickAndCompressImage, Storage upload, sendImageMessage
  await sendImage(user.uid, otherUser.uid)
  // chatStore.isLoading covers the upload period — LoadingOverlay reads it
}
```

Show `<LoadingOverlay visible={isLoading} message={t('chat.uploading')} />` where `isLoading` comes directly from `chatStore`. No separate `isUploading` local state is needed unless the store exposes a dedicated upload flag — check `chatStore` and use whichever boolean covers the upload window.

### Long press on message

Show `Alert.alert` with options:
- Own messages: "Copy", "Delete" (stub — TODO: RTDB delete in Phase 2)
- Others' messages: "Copy", "Report" (stub — TODO Task 38)
- "Copy": use `import { Clipboard } from 'react-native'` to avoid new dependency (deprecated but functional; proper library deferred to Phase 2)

### Fullscreen image viewer

When user taps an image in a `MessageBubble`:
- Show a Modal (`transparent`, `animationType="fade"`) containing:
  - Black background
  - The image (full screen, `resizeMode="contain"`)
  - Close button top-right (Ionicons `close`, white, size 28)
- No pinch-to-zoom required here (Phase 2 enhancement — keep it simple)

### Screen layout (top to bottom)

```
SafeAreaView (flex: 1, backgroundColor: colors.background)
  KeyboardAvoidingView (flex: 1, behavior: Platform.OS === 'ios' ? 'padding' : 'height')
    FlatList (flex: 1, inverted)
    TypingIndicator (conditional, inside FlatList ListHeaderComponent)
    IcebreakerRow (conditional, shows only when messages.length === 0)
    ChatInput (fixed at bottom, above keyboard)
  LoadingOverlay (visible={isLoading from chatStore}, for image upload)
```

### Local state

```typescript
// isLoading from chatStore covers image upload — no isUploading needed here
const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null)
const [isOtherOnline, setIsOtherOnline] = useState(false)
const [otherLastSeen, setOtherLastSeen] = useState<number | null>(null)
```

Wire `subscribeToPresence(matchId, otherUser.uid, (online, lastSeen) => { ... })` from `realtime.ts` in `useEffect`.

---

## 5. `app/navigation/MainTabNavigator.tsx` — Update

The `MatchesNavigator` stack already has a `Chat` placeholder. Replace it:

```typescript
// Add import:
import ChatScreen from '@/app/chat/ChatScreen'

// Remove Chat placeholder component (the inline View/Text one)

// The Stack.Screen registration stays the same:
<Stack.Screen
  name="Chat"
  component={ChatScreen}
  options={{ headerShown: false }}   // ChatScreen manages its own header via navigation.setOptions
/>
```

Do not touch the `Matches` screen registration or MainTabNavigator tab structure.

---

## 6. i18n Updates

Add to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`) under the `chat` namespace. Use the English value as placeholder for non-English files:

```json
{
  "chat": {
    "uploading": "Uploading image...",
    "imageFailed": "Image failed to send. Tap to retry.",
    "deleteMessage": "Delete Message",
    "copyMessage": "Copy",
    "reportMessage": "Report",
    "activeNow": "Active now",
    "activeAgo": "Active {{time}} ago",
    "menuViewProfile": "View Profile",
    "menuUnmatch": "Unmatch",
    "menuReport": "Report User",
    "icebreakerHint": "Break the ice 👋",
    "noMessages": "Say hello to {{name}}!"
  }
}
```

Check existing `chat.*` keys — add only what is missing, do not duplicate or overwrite.

---

## Architecture Notes for Codex

1. **`sendImage` in chatStore owns the full image flow** — confirmed from Task 31. It handles `pickAndCompressImage`, Firebase Storage upload, download URL retrieval, and `sendImageMessage`. Its signature is `sendImage(currentUserId, recipientId)`. ChatScreen calls it directly and reads `chatStore.isLoading` for the overlay. Do NOT add upload logic to ChatScreen or ChatInput.

2. **Inverted FlatList** — with `inverted={true}`, the `ListHeaderComponent` renders at the visual bottom (above the last message). This is where typing indicator goes. Icebreaker chips render outside the FlatList, between FlatList and ChatInput.

3. **No RTDB reads from ChatScreen directly** — all RTDB interaction goes through `chatStore` or `realtime.ts` service. ChatScreen only calls store actions.

4. **AppState listener** — Task 31 deferred wiring `flushOfflineQueue` to AppState. Wire it in ChatScreen's `useEffect`:
   ```typescript
   const subscription = AppState.addEventListener('change', (state) => {
     if (state === 'active') flushOfflineQueue()
   })
   return () => subscription.remove()
   ```

5. **No `useState` for messages** — messages come from `chatStore`. `useState` is only for: `isUploading`, `imageViewerUrl`, `isOtherOnline`, `otherLastSeen`, local input text (inside ChatInput).

6. **`navigation.setOptions` for header** — call inside `useEffect` after `otherUser` is resolved. Guard with `if (!otherUser) return` to avoid setting options with undefined data.

7. **Unmatch flow** — after `matchStore.unmatch(matchId)` resolves, call `navigation.goBack()`. The match will disappear from `MatchesScreen` automatically via the real-time listener.

8. **Date header grouping** — the simplest implementation is to transform `messages` into a mixed array of `{ type: 'message', data: RTDBMessage }` and `{ type: 'date-header', label: string }` items before passing to FlatList. Do this computation with `useMemo`.

9. **`borderRadius` token** — import from `constants/theme`. If it does not exist yet on the theme object, define `borderRadius.sm = 4`, `borderRadius.md = 12`, `borderRadius.lg = 18` in `constants/theme.ts`. Do not hardcode corner values in StyleSheet.

10. **Clipboard** — use `import { Clipboard } from 'react-native'` (no new dependency). This is deprecated but functional; proper library deferred to Phase 2.

---

## Acceptance Criteria

- [ ] `MessageBubble` renders sent (right, green) and received (left, gray) text bubbles correctly
- [ ] `MessageBubble` renders image thumbnails; tap opens fullscreen modal
- [ ] Timestamp appears every 5th message and on long press
- [ ] Read receipt icon shows single/double/blue checkmark correctly
- [ ] `ChatInput` grows up to 4 lines, send button enabled/disabled based on text
- [ ] Image picker opens from ChatInput image button, image is compressed then uploaded
- [ ] `ChatScreen` header shows other user's name and online status
- [ ] `ChatScreen` header 3-dot menu has Unmatch (with confirmation) and View Profile/Report stubs
- [ ] Unmatch navigates back to MatchesScreen after deleting match
- [ ] Messages load from `chatStore` in real time (inverted FlatList, newest at bottom)
- [ ] Date separators appear between message groups from different days
- [ ] Icebreaker chips appear when `messages.length === 0`, tapping pre-fills input
- [ ] Typing indicator (animated 3 dots) appears when `chatStore.isTyping === true`
- [ ] `onTypingStart` called on every keystroke
- [ ] `markAsRead` called on mount and when screen comes to foreground
- [ ] `flushOfflineQueue` called on mount and on AppState foreground
- [ ] `LoadingOverlay` shown during image upload (driven by `chatStore.isLoading`)
- [ ] Long press on own message shows Copy / Delete options
- [ ] Long press on other's message shows Copy / Report options
- [ ] `Chat` placeholder in `MainTabNavigator` replaced with real `ChatScreen`
- [ ] Missing `chat.*` i18n keys added to all 4 language files
- [ ] Zero inline styles, all text through `t()`
- [ ] `tsc --noEmit` passes with zero TypeScript errors

## Do Not Touch
`store/chatStore.ts`, `store/matchStore.ts`, `store/authStore.ts`, `services/firebase/realtime.ts`, `services/firebase/storage.ts`, `components/ui/`, `types/`, `constants/`, `app/onboarding/`, `app/discovery/`, `app/matches/MatchesScreen.tsx`, `functions/`

## Commit
`git commit -m "task-32: chat screen with message bubbles, chat input, image send, typing indicator"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 4.4] — YYYY-MM-DD
### Completed
- Task 32: ChatScreen built — real-time messages, MessageBubble, ChatInput, typing indicator, image send
- MessageBubble: sent/received variants, image support, timestamp, read receipts
- ChatInput: multiline auto-grow, image picker (delegates to chatStore.sendImage), send button state
- ChatScreen: custom header (name + online status + 3-dot menu), inverted FlatList, date separators, icebreaker chips, fullscreen image viewer, unmatch flow
- chat.uploading and other missing chat.* i18n keys added to all 4 language files
- AppState listener for flushOfflineQueue wired in ChatScreen (deferred from Task 31)
- Image upload driven by chatStore.sendImage internally — no storage changes in this task

### Files Created / Modified
- components/chat/MessageBubble.tsx: bubble variants, image thumbnail, timestamp, read receipts
- components/chat/ChatInput.tsx: multiline input, image button (calls chatStore.sendImage), send button
- app/chat/ChatScreen.tsx: full conversation screen with all features
- app/navigation/MainTabNavigator.tsx: Chat placeholder replaced with ChatScreen
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys completed

### Known Issues / Deferred
- "View Profile" from chat header menu is a stub — deferred to FullProfileModal Phase 2 integration
- "Report User" from chat header is a stub — wired in Task 38
- "Delete Message" from long press is a stub — RTDB delete deferred to Phase 2
- Pinch-to-zoom in fullscreen image viewer deferred to Phase 2
- Proper clipboard library (@react-native-clipboard/clipboard) deferred to Phase 2

### Next Up
- Task 33: Cloud Function onNewMessage (RTDB trigger → Expo push notification on new chat message)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 33 prompt.

---

## Reasoning Level
High