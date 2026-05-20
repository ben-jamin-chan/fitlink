import {
  off,
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
  update,
} from 'firebase/database'
import type { DatabaseReference, DataSnapshot } from 'firebase/database'
import {
  doc,
  serverTimestamp as firestoreServerTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db, rtdb } from '@/services/firebase/config'

export interface RTDBMessage {
  id: string
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
  [key: `${string}_typing`]: boolean
  [key: `${string}_unread`]: number
}

export interface RTDBPresence {
  online: boolean
  lastSeen: number
}

export interface QueuedMessage {
  matchId: string
  senderId: string
  recipientId: string
  text: string
  queuedAt: number
}

type RTDBMessagePayload = Omit<RTDBMessage, 'id'>

const PHOTO_MESSAGE_PREVIEW = '📷 Photo'
const LAST_MESSAGE_PREVIEW_LIMIT = 80

const buildTextPreview = (text: string): string => {
  if (text.length <= LAST_MESSAGE_PREVIEW_LIMIT) {
    return text
  }

  return `${text.slice(0, LAST_MESSAGE_PREVIEW_LIMIT)}…`
}

export const subscribeToMessages = (
  matchId: string,
  callback: (messages: RTDBMessage[]) => void
): DatabaseReference => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)

  onValue(messagesRef, (snapshot: DataSnapshot): void => {
    // RTDB snapshots are untyped at the SDK boundary; this path stores message
    // payloads keyed by push id, matching RTDBMessagePayload.
    const raw = snapshot.val() as Record<string, RTDBMessagePayload> | null

    if (raw === null) {
      callback([])
      return
    }

    const messages: RTDBMessage[] = Object.entries(raw)
      .map(([id, data]) => ({ id, ...data }))
      .sort(
        (first: RTDBMessage, second: RTDBMessage): number =>
          first.timestamp - second.timestamp
      )

    callback(messages)
  })

  return messagesRef
}

export const unsubscribeFromMessages = (
  messagesRef: DatabaseReference
): void => {
  off(messagesRef)
}

export const sendTextMessage = async (
  matchId: string,
  senderId: string,
  _recipientId: string,
  text: string
): Promise<string> => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)
  const newRef = push(messagesRef)

  if (newRef.key === null) {
    throw new Error('rtdb-message-key-missing')
  }

  await set(newRef, {
    senderId,
    text,
    imageUrl: null,
    timestamp: rtdbServerTimestamp(),
    read: false,
  })

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: buildTextPreview(text),
    lastMessageAt: firestoreServerTimestamp(),
  })

  return newRef.key
}

export const sendImageMessage = async (
  matchId: string,
  senderId: string,
  _recipientId: string,
  imageUrl: string
): Promise<string> => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)
  const newRef = push(messagesRef)

  if (newRef.key === null) {
    throw new Error('rtdb-message-key-missing')
  }

  await set(newRef, {
    senderId,
    text: null,
    imageUrl,
    timestamp: rtdbServerTimestamp(),
    read: false,
  })

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: PHOTO_MESSAGE_PREVIEW,
    lastMessageAt: firestoreServerTimestamp(),
  })

  return newRef.key
}

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

  await updateDoc(doc(db, 'matches', matchId), {
    [`${currentUserId}_unread`]: 0,
  })
}

export const setTypingStatus = async (
  matchId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  const typingRef = ref(rtdb, `chats/${matchId}/metadata/${userId}_typing`)
  await set(typingRef, isTyping)
}

export const subscribeToTyping = (
  matchId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): DatabaseReference => {
  const typingRef = ref(rtdb, `chats/${matchId}/metadata/${otherUserId}_typing`)

  onValue(typingRef, (snapshot: DataSnapshot): void => {
    // RTDB snapshots are untyped at the SDK boundary; this path stores a
    // nullable boolean typing flag.
    const value = snapshot.val() as boolean | null
    callback(value === true)
  })

  return typingRef
}

export const registerPresence = async (
  matchId: string,
  userId: string
): Promise<void> => {
  const onlineRef = ref(rtdb, `chats/${matchId}/presence/${userId}_online`)
  const lastSeenRef = ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`)

  await onDisconnect(onlineRef).set(false)
  await onDisconnect(lastSeenRef).set(rtdbServerTimestamp())
  await set(onlineRef, true)
  await set(lastSeenRef, rtdbServerTimestamp())
}

export const setOffline = async (
  matchId: string,
  userId: string
): Promise<void> => {
  await set(ref(rtdb, `chats/${matchId}/presence/${userId}_online`), false)
  await set(
    ref(rtdb, `chats/${matchId}/presence/${userId}_lastSeen`),
    rtdbServerTimestamp()
  )
}

export const subscribeToPresence = (
  matchId: string,
  otherUserId: string,
  callback: (presence: RTDBPresence) => void
): DatabaseReference => {
  const presenceRef = ref(rtdb, `chats/${matchId}/presence`)

  onValue(presenceRef, (snapshot: DataSnapshot): void => {
    // RTDB snapshots are untyped at the SDK boundary; presence stores dynamic
    // participant keys with boolean online flags and numeric lastSeen values.
    const data = snapshot.val() as Record<string, boolean | number> | null
    const online = data?.[`${otherUserId}_online`]
    const lastSeen = data?.[`${otherUserId}_lastSeen`]

    callback({
      online: typeof online === 'boolean' ? online : false,
      lastSeen: typeof lastSeen === 'number' ? lastSeen : 0,
    })
  })

  return presenceRef
}
