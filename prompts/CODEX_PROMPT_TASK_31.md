# CODEX PROMPT — Task 31
# Chat Store + Firebase Realtime Database Service Layer

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 4.2 complete. Task 30 (MatchesScreen) is done and committed. Relevant existing files:

- `store/matchStore.ts` — `MatchWithProfile[]` state, `subscribeToMatches`, `unmatch`, `markAsRead`, `newMatchIds` array; `unsubscribeFromMatches` available
- `services/firebase/firestore.ts` — `subscribeToMatches`, `deleteMatch`, `resetUnreadCount`, `getUserProfile` implemented; `updateDoc` and `increment` already imported
- `services/firebase/config.ts` — exports `rtdb` (Firebase Realtime Database instance), `db` (Firestore), `auth`
- `services/firebase/storage.ts` — `uploadProfilePhoto` exists; pattern for upload-and-get-URL established
- `types/message.ts` — `Message` interface with `senderId`, `text`, `type: 'text' | 'image' | 'voice'`, `readBy: string[]`, `createdAt: Timestamp`
- `types/match.ts` — `Match`, `MatchWithProfile` interfaces confirmed
- `utils/imageUtils.ts` — `pickAndCompressImage`, `compressImage` available
- `utils/errorUtils.ts` — `mapFirebaseError` available
- `store/authStore.ts` — `user` (Firebase User) and `isAuthenticated` available
- `components/ui/Toast.tsx` — `showToast(message, type)` available
- `app/matches/MatchesScreen.tsx` — navigates to `ChatScreen` with `{ matchId: string }` param; `MatchesNavigator` stack registered in `MainTabNavigator`
- `i18n/en.json` — `chat.*` namespace keys need to be seeded in this task

Task 31 builds the **real-time chat data layer only**: `services/firebase/realtime.ts` and `store/chatStore.ts`. The UI (ChatScreen, MessageBubble, ChatInput) is Task 32. Do not build screen-level components in this task.

---

## Task 31 — Chat Store + Realtime Database Service Layer

**Files to create:**
- `services/firebase/realtime.ts`
- `store/chatStore.ts`

**Files to modify:**
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `chat.*` i18n keys

**Do not create or touch:**
- `app/chat/ChatScreen.tsx` — Task 32
- `components/chat/MessageBubble.tsx` — Task 32
- `components/chat/ChatInput.tsx` — Task 32
- Any other store, service, or component file

---

## RTDB Schema (from ARCHITECT.md)

Codex must use this exact path structure — do not deviate:

```
/chats/{matchId}/messages/{messageId}
  senderId: string
  text: string | null
  imageUrl: string | null
  timestamp: number            ← RTDB server timestamp (number, not Firestore Timestamp)
  read: boolean

/chats/{matchId}/metadata
  participants: [uid1, uid2]
  lastMessage: string
  lastMessageTimestamp: number
  {uid}_typing: boolean        ← one key per participant
  {uid}_unread: number         ← one key per participant

/chats/{matchId}/presence
  {uid}_online: boolean
  {uid}_lastSeen: number
```

**Critical distinction:** RTDB uses `number` timestamps (milliseconds since epoch), not Firestore `Timestamp` objects. The `Message` type in `types/message.ts` uses `Timestamp` for Firestore messages — the RTDB layer uses a separate `RTDBMessage` type defined in `realtime.ts`.

---

## `services/firebase/realtime.ts`

All RTDB interactions. No UI logic. All functions typed. No `any`.

```typescript
import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  off,
  serverTimestamp,
  onDisconnect,
  DatabaseReference,
  DataSnapshot,
} from 'firebase/database'
import { doc, updateDoc, increment } from 'firebase/firestore'
import { rtdb, db } from '@/services/firebase/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RTDBMessage {
  id: string                  // messageId (key from push())
  senderId: string
  text: string | null
  imageUrl: string | null
  timestamp: number
  read: boolean
}

export interface RTDBMetadata {
  participants: string[]
  lastMessage: string
  lastMessageTimestamp: number
}

export interface RTDBPresence {
  online: boolean
  lastSeen: number
}

// ─── Message Subscription ─────────────────────────────────────────────────────

/**
 * Subscribe to all messages in a chat.
 * Calls callback with the full ordered message array on every change.
 * Returns the DatabaseReference so caller can call off() to unsubscribe.
 */
export const subscribeToMessages = (
  matchId: string,
  callback: (messages: RTDBMessage[]) => void
): DatabaseReference => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)

  onValue(messagesRef, (snapshot: DataSnapshot) => {
    const raw = snapshot.val() as Record<string, Omit<RTDBMessage, 'id'>> | null
    if (!raw) {
      callback([])
      return
    }
    const messages: RTDBMessage[] = Object.entries(raw)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.timestamp - b.timestamp)
    callback(messages)
  })

  return messagesRef
}

/**
 * Detach listener from a messages ref returned by subscribeToMessages.
 */
export const unsubscribeFromMessages = (messagesRef: DatabaseReference): void => {
  off(messagesRef)
}

// ─── Send Message ─────────────────────────────────────────────────────────────

/**
 * Push a new text message to RTDB and update Firestore match metadata.
 * @returns The new message ID from RTDB push()
 */
export const sendTextMessage = async (
  matchId: string,
  senderId: string,
  recipientId: string,
  text: string
): Promise<string> => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)
  const newRef = push(messagesRef)

  const messageData: Omit<RTDBMessage, 'id'> = {
    senderId,
    text,
    imageUrl: null,
    timestamp: Date.now(),   // optimistic; Cloud Function will correct with serverTimestamp
    read: false,
  }

  await set(newRef, {
    ...messageData,
    timestamp: serverTimestamp(),   // RTDB server timestamp overwrites Date.now()
  })

  // Update Firestore match doc — lastMessage preview + increment recipient unread
  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: text.length > 80 ? text.slice(0, 80) + '…' : text,
    lastMessageAt: new Date(),     // Firestore client timestamp (server timestamp not needed for display)
    [`${recipientId}_unread`]: increment(1),
  })

  return newRef.key as string
}

/**
 * Push a new image message to RTDB and update Firestore match metadata.
 */
export const sendImageMessage = async (
  matchId: string,
  senderId: string,
  recipientId: string,
  imageUrl: string
): Promise<string> => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)
  const newRef = push(messagesRef)

  await set(newRef, {
    senderId,
    text: null,
    imageUrl,
    timestamp: serverTimestamp(),
    read: false,
  })

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: '📷 Photo',
    lastMessageAt: new Date(),
    [`${recipientId}_unread`]: increment(1),
  })

  return newRef.key as string
}

// ─── Read Receipts ────────────────────────────────────────────────────────────

/**
 * Mark all unread messages from the other user as read.
 * Also resets the caller's unread count on the Firestore match doc.
 */
export const markMessagesAsRead = async (
  matchId: string,
  currentUserId: string,
  unreadMessageIds: string[]
): Promise<void> => {
  const updates: Record<string, boolean> = {}
  for (const messageId of unreadMessageIds) {
    updates[`chats/${matchId}/messages/${messageId}/read`] = true
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(rtdb), updates)
  }
  // Reset unread counter on Firestore match doc
  await updateDoc(doc(db, 'matches', matchId), {
    [`${currentUserId}_unread`]: 0,
  })
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

/**
 * Set typing status for the current user in RTDB.
 * Call with isTyping=true when user starts typing, false when they stop.
 */
export const setTypingStatus = async (
  matchId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  const typingRef = ref(rtdb, `chats/${matchId}/metadata/${userId}_typing`)
  await set(typingRef, isTyping)
}

/**
 * Subscribe to the other user's typing status.
 * Returns the DatabaseReference for cleanup.
 */
export const subscribeToTyping = (
  matchId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): DatabaseReference => {
  const typingRef = ref(rtdb, `chats/${matchId}/metadata/${otherUserId}_typing`)
  onValue(typingRef, (snapshot) => {
    callback(snapshot.val() === true)
  })
  return typingRef
}

// ─── Presence ─────────────────────────────────────────────────────────────────

/**
 * Register the current user as online in a chat.
 * Automatically sets them offline on disconnect via RTDB onDisconnect().
 */
export const registerPresence = async (
  matchId: string,
  userId: string
): Promise<void> => {
  const onlineRef = ref(rtdb, `chats/${matchId}/presence/${userId}_online`)
  const lastSeenRef = ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`)

  await set(onlineRef, true)
  await set(lastSeenRef, serverTimestamp())

  // Auto-set offline on disconnect
  onDisconnect(onlineRef).set(false)
  onDisconnect(lastSeenRef).set(serverTimestamp())
}

/**
 * Manually set the current user offline in a chat (called when screen unmounts).
 */
export const setOffline = async (
  matchId: string,
  userId: string
): Promise<void> => {
  await set(ref(rtdb, `chats/${matchId}/presence/${userId}_online`), false)
  await set(ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`), serverTimestamp())
}

/**
 * Subscribe to the other user's online presence.
 * Returns { online: boolean, lastSeen: number } on every change.
 */
export const subscribeToPresence = (
  matchId: string,
  otherUserId: string,
  callback: (presence: RTDBPresence) => void
): DatabaseReference => {
  const presenceRef = ref(rtdb, `chats/${matchId}/presence`)
  onValue(presenceRef, (snapshot) => {
    const data = snapshot.val() as Record<string, boolean | number> | null
    callback({
      online: (data?.[`${otherUserId}_online`] as boolean) ?? false,
      lastSeen: (data?.[`${otherUserId}_lastSeen`] as number) ?? 0,
    })
  })
  return presenceRef
}

// ─── Offline Message Queue ────────────────────────────────────────────────────

export interface QueuedMessage {
  matchId: string
  senderId: string
  recipientId: string
  text: string
  queuedAt: number
}
```

---

## `store/chatStore.ts`

Zustand store managing the active chat session. Handles subscription lifecycle, offline queue via AsyncStorage, image uploads, and typing debounce.

```typescript
import { create } from 'zustand'
import { DatabaseReference } from 'firebase/database'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { uploadBytes, getDownloadURL, ref as storageRef } from 'firebase/storage'
import { storage } from '@/services/firebase/config'
import {
  subscribeToMessages,
  unsubscribeFromMessages,
  subscribeToTyping,
  subscribeToPresence,
  sendTextMessage,
  sendImageMessage,
  markMessagesAsRead,
  setTypingStatus,
  registerPresence,
  setOffline,
  RTDBMessage,
  RTDBPresence,
  QueuedMessage,
} from '@/services/firebase/realtime'
import { compressImage, pickAndCompressImage } from '@/utils/imageUtils'
import type { UserProfile } from '@/types/user'

// ─── Constants ────────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = 'chat_offline_queue'
const TYPING_DEBOUNCE_MS = 1000
const MESSAGES_PAGE_SIZE = 50

// ─── State Interface ──────────────────────────────────────────────────────────

interface ChatState {
  // Active session
  activeMatchId: string | null
  otherUser: UserProfile | null

  // Messages
  messages: RTDBMessage[]
  isLoadingMessages: boolean
  isSendingMessage: boolean

  // Real-time status
  isOtherUserTyping: boolean
  otherUserPresence: RTDBPresence

  // Upload
  isUploadingImage: boolean
  uploadProgress: number

  // Error
  error: string | null

  // Internal refs (not persisted)
  _messagesRef: DatabaseReference | null
  _typingRef: DatabaseReference | null
  _presenceRef: DatabaseReference | null
  _typingTimeout: ReturnType<typeof setTimeout> | null
}

interface ChatActions {
  /**
   * Open a chat session for a match. Subscribes to messages, typing, presence.
   * Call when ChatScreen mounts.
   */
  openChat: (matchId: string, currentUserId: string, otherUser: UserProfile) => Promise<void>

  /**
   * Close the active chat session. Unsubscribes all listeners, sets user offline.
   * Call when ChatScreen unmounts.
   */
  closeChat: (currentUserId: string) => Promise<void>

  /**
   * Send a plain text message. Queues offline if RTDB write fails.
   */
  sendMessage: (text: string, currentUserId: string, recipientId: string) => Promise<void>

  /**
   * Open image picker, compress, upload to Storage, then send as image message.
   */
  sendImage: (currentUserId: string, recipientId: string) => Promise<void>

  /**
   * Call when current user starts typing. Debounces the "stopped typing" clear.
   */
  onTypingStart: (matchId: string, currentUserId: string) => void

  /**
   * Mark all messages from other user as read.
   * Call when ChatScreen becomes active/focused.
   */
  markAsRead: (currentUserId: string) => Promise<void>

  /**
   * Flush any queued offline messages. Call when AppState returns to foreground.
   */
  flushOfflineQueue: (currentUserId: string, recipientId: string) => Promise<void>

  clearError: () => void
}

type ChatStore = ChatState & ChatActions

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────────────────
  activeMatchId: null,
  otherUser: null,
  messages: [],
  isLoadingMessages: false,
  isSendingMessage: false,
  isOtherUserTyping: false,
  otherUserPresence: { online: false, lastSeen: 0 },
  isUploadingImage: false,
  uploadProgress: 0,
  error: null,
  _messagesRef: null,
  _typingRef: null,
  _presenceRef: null,
  _typingTimeout: null,

  // ─── openChat ────────────────────────────────────────────────────────────────
  openChat: async (matchId, currentUserId, otherUser) => {
    // Clean up any previous session first
    const prev = get()
    if (prev.activeMatchId && prev.activeMatchId !== matchId) {
      await get().closeChat(currentUserId)
    }

    set({ activeMatchId: matchId, otherUser, isLoadingMessages: true, messages: [], error: null })

    // Messages
    const messagesRef = subscribeToMessages(matchId, (msgs) => {
      set({ messages: msgs, isLoadingMessages: false })
    })

    // Typing
    const typingRef = subscribeToTyping(matchId, otherUser.uid, (isTyping) => {
      set({ isOtherUserTyping: isTyping })
    })

    // Presence
    const presenceRef = subscribeToPresence(matchId, otherUser.uid, (presence) => {
      set({ otherUserPresence: presence })
    })

    set({ _messagesRef: messagesRef, _typingRef: typingRef, _presenceRef: presenceRef })

    // Register self as online
    await registerPresence(matchId, currentUserId)
  },

  // ─── closeChat ───────────────────────────────────────────────────────────────
  closeChat: async (currentUserId) => {
    const { activeMatchId, _messagesRef, _typingRef, _presenceRef, _typingTimeout } = get()

    if (_typingTimeout) clearTimeout(_typingTimeout)
    if (_messagesRef) unsubscribeFromMessages(_messagesRef)
    if (_typingRef) unsubscribeFromMessages(_typingRef)
    if (_presenceRef) unsubscribeFromMessages(_presenceRef)

    if (activeMatchId) {
      // Clear typing + set offline
      await Promise.allSettled([
        setTypingStatus(activeMatchId, currentUserId, false),
        setOffline(activeMatchId, currentUserId),
      ])
    }

    set({
      activeMatchId: null,
      otherUser: null,
      messages: [],
      isLoadingMessages: false,
      isOtherUserTyping: false,
      otherUserPresence: { online: false, lastSeen: 0 },
      _messagesRef: null,
      _typingRef: null,
      _presenceRef: null,
      _typingTimeout: null,
      error: null,
    })
  },

  // ─── sendMessage ─────────────────────────────────────────────────────────────
  sendMessage: async (text, currentUserId, recipientId) => {
    const { activeMatchId } = get()
    if (!activeMatchId || !text.trim()) return

    set({ isSendingMessage: true, error: null })

    try {
      await sendTextMessage(activeMatchId, currentUserId, recipientId, text.trim())
    } catch {
      // Queue for offline retry
      const queued: QueuedMessage = {
        matchId: activeMatchId,
        senderId: currentUserId,
        recipientId,
        text: text.trim(),
        queuedAt: Date.now(),
      }
      await _enqueueOfflineMessage(queued)
      set({ error: 'chat.error.sendFailed' })
    } finally {
      set({ isSendingMessage: false })
    }
  },

  // ─── sendImage ───────────────────────────────────────────────────────────────
  sendImage: async (currentUserId, recipientId) => {
    const { activeMatchId } = get()
    if (!activeMatchId) return

    const uri = await pickAndCompressImage()
    if (!uri) return   // picker cancelled or permission denied

    set({ isUploadingImage: true, uploadProgress: 0, error: null })

    try {
      // Upload to Storage: chats/{matchId}/images/{timestamp}.jpg
      const filename = `chats/${activeMatchId}/images/${Date.now()}.jpg`
      const imageRef = storageRef(storage, filename)
      const response = await fetch(uri)
      const blob = await response.blob()
      await uploadBytes(imageRef, blob)
      const downloadUrl = await getDownloadURL(imageRef)

      set({ uploadProgress: 100 })

      await sendImageMessage(activeMatchId, currentUserId, recipientId, downloadUrl)
    } catch {
      set({ error: 'chat.error.uploadFailed' })
    } finally {
      set({ isUploadingImage: false, uploadProgress: 0 })
    }
  },

  // ─── onTypingStart ────────────────────────────────────────────────────────────
  onTypingStart: (matchId, currentUserId) => {
    const { _typingTimeout } = get()

    // Set typing = true immediately (fire-and-forget, no await in store action)
    void setTypingStatus(matchId, currentUserId, true)

    // Debounce: clear typing after 1 second of inactivity
    if (_typingTimeout) clearTimeout(_typingTimeout)
    const timeout = setTimeout(() => {
      void setTypingStatus(matchId, currentUserId, false)
      set({ _typingTimeout: null })
    }, TYPING_DEBOUNCE_MS)

    set({ _typingTimeout: timeout })
  },

  // ─── markAsRead ───────────────────────────────────────────────────────────────
  markAsRead: async (currentUserId) => {
    const { activeMatchId, messages } = get()
    if (!activeMatchId) return

    const unreadIds = messages
      .filter((m) => m.senderId !== currentUserId && !m.read)
      .map((m) => m.id)

    if (unreadIds.length === 0) return

    await markMessagesAsRead(activeMatchId, currentUserId, unreadIds)
  },

  // ─── flushOfflineQueue ────────────────────────────────────────────────────────
  flushOfflineQueue: async (currentUserId, recipientId) => {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return

    let queue: QueuedMessage[] = []
    try {
      queue = JSON.parse(raw) as QueuedMessage[]
    } catch {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
      return
    }

    const remaining: QueuedMessage[] = []

    for (const queued of queue) {
      try {
        await sendTextMessage(queued.matchId, queued.senderId, queued.recipientId, queued.text)
      } catch {
        remaining.push(queued)
      }
    }

    if (remaining.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
    } else {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
    }
  },

  // ─── clearError ──────────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),
}))

// ─── Private Helpers ──────────────────────────────────────────────────────────

const _enqueueOfflineMessage = async (message: QueuedMessage): Promise<void> => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
  const queue: QueuedMessage[] = raw ? (JSON.parse(raw) as QueuedMessage[]) : []
  queue.push(message)
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}
```

---

## i18n Keys to Add

Add the following under `chat` namespace in all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`). Non-English files use English strings as placeholder values.

```json
"chat": {
  "headerOnline": "Active now",
  "headerLastSeen": "Active {{time}} ago",
  "headerOffline": "",
  "typing": "{{name}} is typing...",
  "inputPlaceholder": "Type a message...",
  "send": "Send",
  "photoMessage": "📷 Photo",
  "icebreaker": "Say hi to {{name}}!",
  "messageCopied": "Message copied",
  "unmatch": "Unmatch",
  "unmatchConfirmTitle": "Unmatch {{name}}?",
  "unmatchConfirmMessage": "This will remove the match and delete all messages.",
  "report": "Report",
  "viewProfile": "View Profile",
  "error": {
    "sendFailed": "Message not sent. It will be resent when you're back online.",
    "uploadFailed": "Photo upload failed. Please try again."
  },
  "empty": {
    "title": "Start the conversation",
    "subtitle": "You and {{name}} matched! Say hello 👋"
  },
  "readReceipt": {
    "sent": "Sent",
    "read": "Read"
  }
}
```

---

## Architecture Notes for Codex

1. **`RTDBMessage` is separate from `Message` (Firestore).** The RTDB uses `number` timestamps. The Firestore `Message` type uses `Timestamp`. Do not conflate them. `chatStore` works exclusively with `RTDBMessage`. Task 32 (ChatScreen) will display `RTDBMessage[]` from the store.

2. **`DatabaseReference` cleanup.** `subscribeToMessages`, `subscribeToTyping`, and `subscribeToPresence` all return a `DatabaseReference`. Store these in `_messagesRef`, `_typingRef`, `_presenceRef` so `closeChat` can call `off()` on them. Memory leaks here will cause duplicate messages across sessions.

3. **Offline queue.** If `sendTextMessage` throws, the message is pushed to `OFFLINE_QUEUE_KEY` in AsyncStorage. `flushOfflineQueue` is called from Task 32's ChatScreen on `AppState` change (`active` → foreground). Do not add the AppState listener in this task — that belongs in the screen layer (Task 32).

4. **Typing debounce.** `onTypingStart` fires `setTypingStatus(true)` immediately, then schedules a timeout to fire `setTypingStatus(false)` after 1 second of no new calls. The timeout handle is stored in `_typingTimeout`. Clear it in `closeChat` to avoid post-unmount state updates.

5. **Image upload path.** `chats/{matchId}/images/{timestamp}.jpg` — NOT under `users/`. This is different from profile photo storage.

6. **No Firestore security rule changes needed in this task.** Reads/writes to RTDB are not governed by `firestore.rules`. RTDB rules are a Phase 2 task.

7. **`void` for fire-and-forget.** Typing status updates are not awaited in `onTypingStart` — use `void` prefix. Do not add `.catch()` noise; if typing status fails silently it is acceptable UX.

8. **No `any`.** All RTDB `snapshot.val()` calls must be typed with a cast (`as SomeType | null`) and null-guarded before use.

9. **`_messagesRef` used for all `off()` calls.** The `unsubscribeFromMessages` helper just calls `off(ref)` — it works for any `DatabaseReference`, not just messages. Reuse it for typing and presence refs in `closeChat` for simplicity.

---

## Acceptance Criteria

- [ ] `services/firebase/realtime.ts` created — all functions exported, zero TypeScript errors
- [ ] `RTDBMessage`, `RTDBPresence`, `QueuedMessage` types exported from `realtime.ts`
- [ ] `store/chatStore.ts` created — `useChatStore` exported as named export
- [ ] `openChat` subscribes to messages, typing, and presence in one call
- [ ] `closeChat` detaches all 3 listeners, clears typing status, sets user offline
- [ ] `sendMessage` writes to RTDB + updates Firestore match doc
- [ ] `sendMessage` queues to AsyncStorage on failure
- [ ] `sendImage` picks → compresses → uploads to Storage → sends imageUrl message
- [ ] `markAsRead` batch-updates all unread RTDB messages + resets Firestore unread counter
- [ ] `onTypingStart` sets typing=true immediately, clears after 1s debounce
- [ ] `flushOfflineQueue` retries queued messages and removes successfully-sent ones
- [ ] `i18n/en.json` `chat.*` keys added; same keys seeded in `my.json`, `zh.json`, `ta.json`
- [ ] No `any` types used anywhere
- [ ] No inline styles (this task has no UI — verify no JSX is created)
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`store/authStore.ts`, `store/matchStore.ts`, `store/discoveryStore.ts`, `store/onboardingStore.ts`, `store/profileStore.ts` (if exists), `services/firebase/auth.ts`, `services/firebase/firestore.ts`, `services/firebase/storage.ts`, `services/firebase/config.ts`, `utils/imageUtils.ts`, `utils/errorUtils.ts`, `types/`, `constants/`, `components/`, `app/`, `functions/`, `App.tsx`

## Commit
`git commit -m "task-31: chat store and RTDB realtime service layer"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 4.3] — YYYY-MM-DD
### Completed
- Task 31: Chat store and Firebase Realtime Database service layer built
- services/firebase/realtime.ts: subscribeToMessages, sendTextMessage, sendImageMessage, markMessagesAsRead, setTypingStatus, subscribeToTyping, registerPresence, setOffline, subscribeToPresence
- store/chatStore.ts: openChat, closeChat, sendMessage, sendImage, onTypingStart, markAsRead, flushOfflineQueue
- RTDBMessage, RTDBPresence, QueuedMessage types defined and exported
- Offline message queue via AsyncStorage (flush on foreground)
- Typing debounce (1 second)
- i18n chat.* namespace added to all 4 language files

### Files Created / Modified
- services/firebase/realtime.ts: full RTDB service layer
- store/chatStore.ts: chat session store with subscriptions, send, upload, queue
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys added

### Known Issues / Deferred
- AppState listener for flushOfflineQueue not yet wired — Task 32 (ChatScreen) calls flushOfflineQueue on foreground
- ChatScreen, MessageBubble, ChatInput not yet built — Task 32
- RTDB security rules not yet set — Phase 2

### Next Up
- Task 32: ChatScreen + MessageBubble + ChatInput (UI layer consuming chatStore)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 32 prompt.

---

## Reasoning Level
Medium-High
