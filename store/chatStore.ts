import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import type { DatabaseReference } from 'firebase/database'
import { create } from 'zustand'

import {
  markMessagesAsRead,
  registerPresence,
  sendImageMessage,
  sendTextMessage,
  setOffline,
  setTypingStatus,
  subscribeToMessages,
  subscribeToPresence,
  subscribeToTyping,
  unsubscribeFromMessages,
} from '@/services/firebase/realtime'
import { storage } from '@/services/firebase/config'

import { pickAndCompressImage } from '@/utils/imageUtils'

import type {
  QueuedMessage,
  RTDBMessage,
  RTDBPresence,
} from '@/services/firebase/realtime'
import type { UserProfile } from '@/types/user'

const OFFLINE_QUEUE_KEY = 'chat_offline_queue'
const TYPING_DEBOUNCE_MS = 1000
const CHAT_IMAGE_CONTENT_TYPE = 'image/jpeg'

interface ChatState {
  activeMatchId: string | null
  otherUser: UserProfile | null
  messages: RTDBMessage[]
  isLoadingMessages: boolean
  isSendingMessage: boolean
  isOtherUserTyping: boolean
  otherUserPresence: RTDBPresence
  isUploadingImage: boolean
  uploadProgress: number
  error: string | null
  _messagesRef: DatabaseReference | null
  _typingRef: DatabaseReference | null
  _presenceRef: DatabaseReference | null
  _typingTimeout: ReturnType<typeof setTimeout> | null
}

interface ChatActions {
  openChat: (
    matchId: string,
    currentUserId: string,
    otherUser: UserProfile
  ) => Promise<void>
  closeChat: (currentUserId: string) => Promise<void>
  sendMessage: (
    text: string,
    currentUserId: string,
    recipientId: string
  ) => Promise<void>
  sendImage: (currentUserId: string, recipientId: string) => Promise<void>
  onTypingStart: (matchId: string, currentUserId: string) => void
  markAsRead: (currentUserId: string) => Promise<void>
  flushOfflineQueue: (
    currentUserId: string,
    recipientId: string
  ) => Promise<void>
  clearError: () => void
}

type ChatStore = ChatState & ChatActions

const initialPresence: RTDBPresence = { online: false, lastSeen: 0 }

export const useChatStore = create<ChatStore>()((set, get) => ({
  activeMatchId: null,
  otherUser: null,
  messages: [],
  isLoadingMessages: false,
  isSendingMessage: false,
  isOtherUserTyping: false,
  otherUserPresence: initialPresence,
  isUploadingImage: false,
  uploadProgress: 0,
  error: null,
  _messagesRef: null,
  _typingRef: null,
  _presenceRef: null,
  _typingTimeout: null,

  openChat: async (
    matchId: string,
    currentUserId: string,
    otherUser: UserProfile
  ): Promise<void> => {
    if (get().activeMatchId !== null) {
      await get().closeChat(currentUserId)
    }

    set({
      activeMatchId: matchId,
      otherUser,
      messages: [],
      isLoadingMessages: true,
      isOtherUserTyping: false,
      otherUserPresence: initialPresence,
      error: null,
    })

    const messagesRef = subscribeToMessages(
      matchId,
      (messages: RTDBMessage[]): void => {
        set({ messages, isLoadingMessages: false })
      }
    )
    const typingRef = subscribeToTyping(
      matchId,
      otherUser.uid,
      (isTyping: boolean): void => {
        set({ isOtherUserTyping: isTyping })
      }
    )
    const presenceRef = subscribeToPresence(
      matchId,
      otherUser.uid,
      (presence: RTDBPresence): void => {
        set({ otherUserPresence: presence })
      }
    )

    set({ _messagesRef: messagesRef, _typingRef: typingRef, _presenceRef: presenceRef })

    await registerPresence(matchId, currentUserId)
  },

  closeChat: async (currentUserId: string): Promise<void> => {
    const {
      activeMatchId,
      _messagesRef,
      _presenceRef,
      _typingRef,
      _typingTimeout,
    } = get()

    if (_typingTimeout !== null) {
      clearTimeout(_typingTimeout)
    }

    if (_messagesRef !== null) {
      unsubscribeFromMessages(_messagesRef)
    }

    if (_typingRef !== null) {
      unsubscribeFromMessages(_typingRef)
    }

    if (_presenceRef !== null) {
      unsubscribeFromMessages(_presenceRef)
    }

    if (activeMatchId !== null) {
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
      isSendingMessage: false,
      isOtherUserTyping: false,
      otherUserPresence: initialPresence,
      isUploadingImage: false,
      uploadProgress: 0,
      error: null,
      _messagesRef: null,
      _typingRef: null,
      _presenceRef: null,
      _typingTimeout: null,
    })
  },

  sendMessage: async (
    text: string,
    currentUserId: string,
    recipientId: string
  ): Promise<void> => {
    const { activeMatchId } = get()
    const trimmedText = text.trim()

    if (activeMatchId === null || trimmedText.length === 0) {
      return
    }

    set({ isSendingMessage: true, error: null })

    try {
      await sendTextMessage(
        activeMatchId,
        currentUserId,
        recipientId,
        trimmedText
      )
    } catch {
      await enqueueOfflineMessage({
        matchId: activeMatchId,
        senderId: currentUserId,
        recipientId,
        text: trimmedText,
        queuedAt: Date.now(),
      })
      set({ error: 'chat.error.sendFailed' })
    } finally {
      set({ isSendingMessage: false })
    }
  },

  sendImage: async (
    currentUserId: string,
    recipientId: string
  ): Promise<void> => {
    const { activeMatchId } = get()

    if (activeMatchId === null) {
      return
    }

    const uri = await pickAndCompressImage()

    if (uri === null) {
      return
    }

    set({ isUploadingImage: true, uploadProgress: 0, error: null })

    try {
      const filename = `chats/${activeMatchId}/images/${Date.now()}.jpg`
      const imageRef = storageRef(storage, filename)
      const response = await fetch(uri)
      const blob = await response.blob()
      set({ uploadProgress: 10 })

      const snapshot = await uploadBytes(imageRef, blob, {
        contentType: CHAT_IMAGE_CONTENT_TYPE,
      })
      const downloadUrl = await getDownloadURL(snapshot.ref)

      set({ uploadProgress: 100 })

      await sendImageMessage(
        activeMatchId,
        currentUserId,
        recipientId,
        downloadUrl
      )
    } catch {
      set({ error: 'chat.error.uploadFailed' })
    } finally {
      set({ isUploadingImage: false, uploadProgress: 0 })
    }
  },

  onTypingStart: (matchId: string, currentUserId: string): void => {
    const { _typingTimeout } = get()

    void setTypingStatus(matchId, currentUserId, true)

    if (_typingTimeout !== null) {
      clearTimeout(_typingTimeout)
    }

    const timeout = setTimeout((): void => {
      void setTypingStatus(matchId, currentUserId, false)
      set({ _typingTimeout: null })
    }, TYPING_DEBOUNCE_MS)

    set({ _typingTimeout: timeout })
  },

  markAsRead: async (currentUserId: string): Promise<void> => {
    const { activeMatchId, messages } = get()

    if (activeMatchId === null) {
      return
    }

    const unreadMessageIds = messages
      .filter(
        (message: RTDBMessage): boolean =>
          message.senderId !== currentUserId && !message.read
      )
      .map((message: RTDBMessage): string => message.id)

    if (unreadMessageIds.length === 0) {
      return
    }

    await markMessagesAsRead(activeMatchId, currentUserId, unreadMessageIds)
  },

  flushOfflineQueue: async (
    currentUserId: string,
    recipientId: string
  ): Promise<void> => {
    const queue = await readOfflineQueue()

    if (queue.length === 0) {
      return
    }

    const remaining: QueuedMessage[] = []

    for (const queuedMessage of queue) {
      if (
        queuedMessage.senderId !== currentUserId ||
        queuedMessage.recipientId !== recipientId
      ) {
        remaining.push(queuedMessage)
        continue
      }

      try {
        await sendTextMessage(
          queuedMessage.matchId,
          queuedMessage.senderId,
          queuedMessage.recipientId,
          queuedMessage.text
        )
      } catch {
        remaining.push(queuedMessage)
      }
    }

    await writeOfflineQueue(remaining)
  },

  clearError: (): void => {
    set({ error: null })
  },
}))

const isQueuedMessage = (value: unknown): value is QueuedMessage => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.matchId === 'string' &&
    typeof value.senderId === 'string' &&
    typeof value.recipientId === 'string' &&
    typeof value.text === 'string' &&
    typeof value.queuedAt === 'number'
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readOfflineQueue = async (): Promise<QueuedMessage[]> => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)

  if (raw === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
      return []
    }

    return parsed.filter(isQueuedMessage)
  } catch {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
    return []
  }
}

const writeOfflineQueue = async (queue: QueuedMessage[]): Promise<void> => {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
    return
  }

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

const enqueueOfflineMessage = async (
  message: QueuedMessage
): Promise<void> => {
  const queue = await readOfflineQueue()
  queue.push(message)
  await writeOfflineQueue(queue)
}
