import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Alert,
  AppState,
  Clipboard,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { AlertButton, ListRenderItemInfo } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { TFunction } from 'i18next'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useMatchStore } from '@/store/matchStore'

import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import type { MatchesStackParamList } from '@/app/navigation/MainTabNavigator'
import {
  subscribeToPresence,
  unsubscribeFromMessages,
} from '@/services/firebase/realtime'
import type { RTDBMessage } from '@/services/firebase/realtime'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type ChatScreenRouteProp = RouteProp<MatchesStackParamList, 'Chat'>
type ChatScreenNavigationProp = StackNavigationProp<
  MatchesStackParamList,
  'Chat'
>

interface MessageListItem {
  type: 'message'
  id: string
  message: RTDBMessage
  messageIndex: number
}

interface DateHeaderItem {
  type: 'date-header'
  id: string
  label: string
}

type ChatListItem = MessageListItem | DateHeaderItem

interface PresenceStatus {
  text: string
  online: boolean
}

interface TypingIndicatorProps {
  name: string
}

const ONE_MINUTE_MS = 60 * 1000
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const HEADER_PHOTO_SIZE = spacing.xxl - spacing.sm
const HEADER_ICON_SIZE = spacing.xxl
const HEADER_PHOTO_RADIUS = HEADER_PHOTO_SIZE / 2
const CLOSE_BUTTON_SIZE = spacing.xxl
const EMPTY_ICON_SIZE = spacing.xxxl
const DOT_SIZE = spacing.sm - spacing.xs / 2
const DOT_BOUNCE = -spacing.xs
const DOT_ANIMATION_DURATION = 360
const DOT_STAGGER_MS = 150
const TIMESTAMP_INTERVAL = 5
const ICEBREAKER_MAX_ACTIVITIES = 1
const ICEBREAKER_CHIP_MAX_WIDTH = spacing.xxxl * 4 + spacing.lg

const getDayKey = (timestamp: number): string => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${year}-${month}-${day}`
}

const getStartOfDay = (timestamp: number): number => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)

  return date.getTime()
}

const isSameDay = (first: number, second: number): boolean =>
  getStartOfDay(first) === getStartOfDay(second)

const formatDateHeader = (timestamp: number, t: TFunction): string => {
  const now = Date.now()

  if (isSameDay(timestamp, now)) {
    return t('chat.date.today')
  }

  if (isSameDay(timestamp, now - ONE_DAY_MS)) {
    return t('chat.date.yesterday')
  }

  const dayDifference = Math.floor(
    (getStartOfDay(now) - getStartOfDay(timestamp)) / ONE_DAY_MS
  )
  const date = new Date(timestamp)

  if (dayDifference < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
}

const buildListData = (
  messages: RTDBMessage[],
  t: TFunction
): ChatListItem[] => {
  const listItems: ChatListItem[] = []
  let activeDayKey: string | null = null

  messages.forEach((message: RTDBMessage, index: number): void => {
    const dayKey = getDayKey(message.timestamp)

    if (dayKey !== activeDayKey) {
      listItems.push({
        type: 'date-header',
        id: `date-${dayKey}`,
        label: formatDateHeader(message.timestamp, t),
      })
      activeDayKey = dayKey
    }

    listItems.push({
      type: 'message',
      id: message.id,
      message,
      messageIndex: index,
    })
  })

  return listItems.reverse()
}

const formatPresenceStatus = (
  isOnline: boolean,
  lastSeen: number | null,
  t: TFunction
): PresenceStatus | null => {
  if (isOnline) {
    return { text: t('chat.activeNow'), online: true }
  }

  if (lastSeen === null) {
    return null
  }

  const diff = Math.max(0, Date.now() - lastSeen)

  if (diff > ONE_DAY_MS) {
    return null
  }

  const time =
    diff < ONE_HOUR_MS
      ? t('chat.time.minutesCompact', {
          count: Math.max(1, Math.floor(diff / ONE_MINUTE_MS)),
        })
      : t('chat.time.hoursCompact', {
          count: Math.max(1, Math.floor(diff / ONE_HOUR_MS)),
        })

  return { text: t('chat.activeAgo', { time }), online: false }
}

const TypingIndicator = ({ name }: TypingIndicatorProps): React.JSX.Element => {
  const { t } = useTranslation()
  const firstDot = useSharedValue(0)
  const secondDot = useSharedValue(0)
  const thirdDot = useSharedValue(0)

  useEffect(() => {
    const createBounceAnimation = (): number =>
      withRepeat(
        withSequence(
          withTiming(DOT_BOUNCE, { duration: DOT_ANIMATION_DURATION }),
          withTiming(0, { duration: DOT_ANIMATION_DURATION })
        ),
        -1
      )

    firstDot.value = createBounceAnimation()
    secondDot.value = withDelay(DOT_STAGGER_MS, createBounceAnimation())
    thirdDot.value = withDelay(DOT_STAGGER_MS * 2, createBounceAnimation())
  }, [firstDot, secondDot, thirdDot])

  const firstDotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: firstDot.value }],
  }))
  const secondDotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: secondDot.value }],
  }))
  const thirdDotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thirdDot.value }],
  }))

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>{t('chat.typing', { name })}</Text>
      <View style={styles.typingDots}>
        <Animated.View style={[styles.typingDot, firstDotStyle]} />
        <Animated.View style={[styles.typingDot, secondDotStyle]} />
        <Animated.View style={[styles.typingDot, thirdDotStyle]} />
      </View>
    </View>
  )
}

const ChatScreen = (): React.JSX.Element | null => {
  const { t } = useTranslation()
  const route = useRoute<ChatScreenRouteProp>()
  const navigation = useNavigation<ChatScreenNavigationProp>()
  const { matchId } = route.params
  const userId = useAuthStore((state) => state.user?.uid)
  const matches = useMatchStore((state) => state.matches)
  const unmatch = useMatchStore((state) => state.unmatch)
  const markMatchAsRead = useMatchStore((state) => state.markAsRead)
  const messages = useChatStore((state) => state.messages)
  const isOtherUserTyping = useChatStore((state) => state.isOtherUserTyping)
  const isUploadingImage = useChatStore((state) => state.isUploadingImage)
  const isSendingMessage = useChatStore((state) => state.isSendingMessage)
  const error = useChatStore((state) => state.error)
  const openChat = useChatStore((state) => state.openChat)
  const closeChat = useChatStore((state) => state.closeChat)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const sendImage = useChatStore((state) => state.sendImage)
  const onTypingStart = useChatStore((state) => state.onTypingStart)
  const markChatAsRead = useChatStore((state) => state.markAsRead)
  const flushOfflineQueue = useChatStore((state) => state.flushOfflineQueue)
  const clearError = useChatStore((state) => state.clearError)

  const flatListRef = useRef<FlatList<ChatListItem>>(null)
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null)
  const [isOtherOnline, setIsOtherOnline] = useState(false)
  const [otherLastSeen, setOtherLastSeen] = useState<number | null>(null)
  const [expandedTimestampIds, setExpandedTimestampIds] = useState<string[]>([])
  const [prefillText, setPrefillText] = useState<string | null>(null)

  const match = useMemo(
    () => matches.find((candidate) => candidate.id === matchId),
    [matchId, matches]
  )
  const otherUser = match?.otherUser
  const otherUserUid = otherUser?.uid
  const listData = useMemo(
    () => buildListData(messages, t),
    [messages, t]
  )
  const presenceStatus = useMemo(
    () => formatPresenceStatus(isOtherOnline, otherLastSeen, t),
    [isOtherOnline, otherLastSeen, t]
  )
  const primaryPhoto = otherUser?.photos[0] ?? null
  const inputDisabled = isUploadingImage || isSendingMessage
  const icebreakers = useMemo((): string[] => {
    if (otherUser === undefined) {
      return []
    }

    const activity = otherUser.activities.slice(0, ICEBREAKER_MAX_ACTIVITIES)[0]

    if (activity === undefined) {
      return [
        t('chat.icebreakers.general', { name: otherUser.firstName }),
      ]
    }

    return [
      t('chat.icebreakers.trainingTime', {
        activity,
        name: otherUser.firstName,
      }),
      t('chat.icebreakers.frequency', {
        activity,
        name: otherUser.firstName,
      }),
      t('chat.icebreakers.general', { name: otherUser.firstName }),
    ]
  }, [otherUser, t])

  const handleViewProfile = useCallback((): void => {
    Alert.alert(t('common.comingSoon'))
  }, [t])

  const handleReport = useCallback((): void => {
    Alert.alert(t('common.comingSoon'))
  }, [t])

  const handleUnmatch = useCallback(async (): Promise<void> => {
    await unmatch(matchId)
    navigation.goBack()
  }, [matchId, navigation, unmatch])

  const handleConfirmUnmatch = useCallback((): void => {
    if (otherUser === undefined) {
      return
    }

    Alert.alert(
      t('chat.confirmUnmatch.title', { name: otherUser.firstName }),
      t('chat.confirmUnmatch.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.confirmUnmatch.confirm'),
          style: 'destructive',
          onPress: (): void => {
            void handleUnmatch()
          },
        },
      ]
    )
  }, [handleUnmatch, otherUser, t])

  const handleActionMenu = useCallback((): void => {
    if (otherUser === undefined) {
      return
    }

    Alert.alert(otherUser.firstName, undefined, [
      { text: t('chat.menuViewProfile'), onPress: handleViewProfile },
      {
        text: t('chat.menuUnmatch'),
        style: 'destructive',
        onPress: handleConfirmUnmatch,
      },
      { text: t('chat.menuReport'), onPress: handleReport },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }, [
    handleConfirmUnmatch,
    handleReport,
    handleViewProfile,
    otherUser,
    t,
  ])

  const handleSendText = useCallback(
    (text: string): void => {
      if (userId === undefined || otherUserUid === undefined) {
        return
      }

      void sendMessage(text, userId, otherUserUid)
    },
    [otherUserUid, sendMessage, userId]
  )

  const handleImagePress = useCallback((): void => {
    if (userId === undefined || otherUserUid === undefined) {
      return
    }

    void sendImage(userId, otherUserUid)
  }, [otherUserUid, sendImage, userId])

  const handleTyping = useCallback((): void => {
    if (userId === undefined) {
      return
    }

    onTypingStart(matchId, userId)
  }, [matchId, onTypingStart, userId])

  const handleCopyMessage = useCallback(
    (message: RTDBMessage): void => {
      const copyValue = message.text ?? message.imageUrl

      if (copyValue === null) {
        return
      }

      Clipboard.setString(copyValue)
      Alert.alert(t('chat.messageCopied'))
    },
    [t]
  )

  const handleLongPressMessage = useCallback(
    (message: RTDBMessage): void => {
      setExpandedTimestampIds((ids) =>
        ids.includes(message.id) ? ids : [...ids, message.id]
      )

      const isMine = message.senderId === userId
      const secondaryAction: AlertButton = isMine
        ? {
            text: t('chat.deleteMessage'),
            style: 'destructive',
            onPress: (): void => {
              Alert.alert(t('common.comingSoon'))
            },
          }
        : {
            text: t('chat.reportMessage'),
            style: 'destructive',
            onPress: handleReport,
          }

      Alert.alert(t('chat.messageOptions'), undefined, [
        {
          text: t('chat.copyMessage'),
          onPress: (): void => handleCopyMessage(message),
        },
        secondaryAction,
        { text: t('common.cancel'), style: 'cancel' },
      ])
    },
    [handleCopyMessage, handleReport, t, userId]
  )

  const handleForegroundWork = useCallback((): void => {
    if (userId === undefined || otherUserUid === undefined) {
      return
    }

    void flushOfflineQueue(userId, otherUserUid)
    void markChatAsRead(userId)
    void markMatchAsRead(matchId)
  }, [
    flushOfflineQueue,
    markChatAsRead,
    markMatchAsRead,
    matchId,
    otherUserUid,
    userId,
  ])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatListItem>): React.JSX.Element | null => {
      if (item.type === 'date-header') {
        return (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{item.label}</Text>
          </View>
        )
      }

      const showTimestamp =
        item.messageIndex === 0 ||
        (item.messageIndex + 1) % TIMESTAMP_INTERVAL === 0 ||
        expandedTimestampIds.includes(item.message.id)

      return (
        <MessageBubble
          message={item.message}
          isMine={item.message.senderId === userId}
          showTimestamp={showTimestamp}
          onImagePress={setImageViewerUrl}
          onLongPress={handleLongPressMessage}
        />
      )
    },
    [expandedTimestampIds, handleLongPressMessage, userId]
  )

  const renderEmptyState = useCallback((): React.JSX.Element | null => {
    if (otherUser === undefined) {
      return null
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={EMPTY_ICON_SIZE}
          color={colors.gray[300]}
        />
        <Text style={styles.emptyText}>
          {t('chat.noMessages', { name: otherUser.firstName })}
        </Text>
      </View>
    )
  }, [otherUser, t])

  useEffect(() => {
    if (otherUser === undefined) {
      return undefined
    }

    navigation.setOptions({
      headerLeft: (): React.JSX.Element => (
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          accessibilityLabel={t('common.back')}
        >
          <Ionicons
            name="chevron-back"
            size={typography.sizes.xl}
            color={colors.gray[800]}
          />
        </TouchableOpacity>
      ),
      headerRight: (): React.JSX.Element => (
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleActionMenu}
          activeOpacity={0.75}
          accessibilityLabel={t('chat.menu')}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={typography.sizes.xl}
            color={colors.gray[800]}
          />
        </TouchableOpacity>
      ),
      headerShadowVisible: false,
      headerShown: true,
      headerStyle: styles.headerBar,
      headerTitle: (): React.JSX.Element => (
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={handleViewProfile}
          activeOpacity={0.8}
        >
          {primaryPhoto === null ? (
            <View style={styles.headerPhotoPlaceholder}>
              <Ionicons
                name="person"
                size={typography.sizes.xl}
                color={colors.gray[400]}
              />
            </View>
          ) : (
            <Image source={{ uri: primaryPhoto }} style={styles.headerPhoto} />
          )}

          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherUser.firstName}
            </Text>
            {presenceStatus !== null && (
              <Text
                style={[
                  styles.headerStatus,
                  presenceStatus.online
                    ? styles.headerStatusOnline
                    : styles.headerStatusOffline,
                ]}
                numberOfLines={1}
              >
                {presenceStatus.text}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ),
    })

    return undefined
  }, [
    handleActionMenu,
    handleViewProfile,
    navigation,
    otherUser,
    presenceStatus,
    primaryPhoto,
    t,
  ])

  useEffect(() => {
    if (
      userId === undefined ||
      otherUser === undefined ||
      otherUserUid === undefined
    ) {
      return undefined
    }

    void flushOfflineQueue(userId, otherUserUid)
    void openChat(matchId, userId, otherUser).then(() => {
      void markChatAsRead(userId)
      void markMatchAsRead(matchId)
    })

    return (): void => {
      void closeChat(userId)
    }
  }, [
    closeChat,
    flushOfflineQueue,
    markChatAsRead,
    markMatchAsRead,
    matchId,
    openChat,
    otherUserUid,
    userId,
  ])

  useEffect(() => {
    if (otherUserUid === undefined) {
      return undefined
    }

    const presenceRef = subscribeToPresence(
      matchId,
      otherUserUid,
      (presence): void => {
        setIsOtherOnline(presence.online)
        setOtherLastSeen(presence.lastSeen > 0 ? presence.lastSeen : null)
      }
    )

    return (): void => {
      unsubscribeFromMessages(presenceRef)
    }
  }, [matchId, otherUserUid])

  useEffect(() => {
    if (userId === undefined || messages.length === 0) {
      return
    }

    void markChatAsRead(userId)
    void markMatchAsRead(matchId)
  }, [markChatAsRead, markMatchAsRead, matchId, messages.length, userId])

  useEffect(() => {
    if (error === null) {
      return
    }

    Alert.alert(t(error))
    clearError()
  }, [clearError, error, t])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state): void => {
      if (state === 'active') {
        handleForegroundWork()
      }
    })

    return (): void => {
      subscription.remove()
    }
  }, [handleForegroundWork])

  useFocusEffect(
    useCallback((): void => {
      handleForegroundWork()
    }, [handleForegroundWork])
  )

  if (userId === undefined || otherUser === undefined) {
    return null
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item: ChatListItem): string => item.id}
          renderItem={renderItem}
          inverted
          style={styles.messageList}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && styles.messagesEmptyContent,
          ]}
          ListEmptyComponent={renderEmptyState}
          ListHeaderComponent={
            isOtherUserTyping ? (
              <TypingIndicator name={otherUser.firstName} />
            ) : null
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToOffset({
              animated: false,
              offset: 0,
            })
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {messages.length === 0 && icebreakers.length > 0 && (
          <View style={styles.icebreakerContainer}>
            <Text style={styles.icebreakerTitle}>
              {t('chat.icebreakerHint')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.icebreakerList}
            >
              {icebreakers.map((icebreaker: string): React.JSX.Element => (
                <TouchableOpacity
                  key={icebreaker}
                  style={styles.icebreakerChip}
                  onPress={() => setPrefillText(icebreaker)}
                  activeOpacity={0.78}
                >
                  <Text style={styles.icebreakerText}>{icebreaker}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <ChatInput
          onSendText={handleSendText}
          onImagePress={handleImagePress}
          onTyping={handleTyping}
          disabled={inputDisabled}
          prefillText={prefillText}
          onPrefillUsed={() => setPrefillText(null)}
        />
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={imageViewerUrl !== null}
        onRequestClose={() => setImageViewerUrl(null)}
      >
        <View style={styles.imageViewerBackdrop}>
          {imageViewerUrl !== null && (
            <Image
              source={{ uri: imageViewerUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
              accessibilityLabel={t('chat.imageAlt')}
            />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setImageViewerUrl(null)}
            activeOpacity={0.75}
            accessibilityLabel={t('common.close')}
          >
            <Ionicons
              name="close"
              size={typography.sizes.xxl - spacing.xs}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
      </Modal>

      <LoadingOverlay
        visible={isUploadingImage}
        message={t('chat.uploading')}
      />
    </SafeAreaView>
  )
}

export default ChatScreen

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    height: CLOSE_BUTTON_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.xl,
    width: CLOSE_BUTTON_SIZE,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateHeaderText: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    color: colors.gray[500],
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    color: colors.gray[500],
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },
  fullscreenImage: {
    height: '100%',
    width: '100%',
  },
  headerBar: {
    backgroundColor: colors.surface,
  },
  headerIconButton: {
    alignItems: 'center',
    height: HEADER_ICON_SIZE,
    justifyContent: 'center',
    width: HEADER_ICON_SIZE,
  },
  headerName: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  headerPhoto: {
    backgroundColor: colors.gray[200],
    borderRadius: HEADER_PHOTO_RADIUS,
    height: HEADER_PHOTO_SIZE,
    width: HEADER_PHOTO_SIZE,
  },
  headerPhotoPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: HEADER_PHOTO_RADIUS,
    height: HEADER_PHOTO_SIZE,
    justifyContent: 'center',
    width: HEADER_PHOTO_SIZE,
  },
  headerStatus: {
    fontSize: typography.sizes.xs,
  },
  headerStatusOffline: {
    color: colors.gray[500],
  },
  headerStatusOnline: {
    color: colors.primary,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  icebreakerChip: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: ICEBREAKER_CHIP_MAX_WIDTH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  icebreakerContainer: {
    backgroundColor: colors.background,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  icebreakerList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icebreakerText: {
    color: colors.gray[800],
    fontSize: typography.sizes.sm,
  },
  icebreakerTitle: {
    color: colors.gray[500],
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.md,
  },
  imageViewerBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: 'center',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  messagesEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  typingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingDot: {
    backgroundColor: colors.gray[500],
    borderRadius: borderRadius.full,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  typingDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typingText: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
  },
})
