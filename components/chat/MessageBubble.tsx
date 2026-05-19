import React, { useState } from 'react'

import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import type { RTDBMessage } from '@/services/firebase/realtime'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75
const BUBBLE_RADIUS = borderRadius.lg + spacing.xs / 2
const IMAGE_SIZE = spacing.xxxl * 3 + spacing.sm
const IMAGE_RADIUS = borderRadius.md + spacing.xs
const READ_RECEIPT_SIZE = typography.sizes.md
const ONE_MINUTE_MS = 60 * 1000
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS
const ONE_DAY_MS = 24 * ONE_HOUR_MS

interface MessageBubbleProps {
  message: RTDBMessage
  isMine: boolean
  showTimestamp: boolean
  onImagePress: (url: string) => void
  onLongPress: (message: RTDBMessage) => void
}

const formatTimestamp = (timestamp: number, t: TFunction): string => {
  const now = Date.now()
  const diff = Math.max(0, now - timestamp)

  if (diff < ONE_MINUTE_MS) {
    return t('chat.time.justNow')
  }

  if (diff < ONE_HOUR_MS) {
    return t('chat.time.minutesAgo', {
      count: Math.floor(diff / ONE_MINUTE_MS),
    })
  }

  if (diff < ONE_DAY_MS && isSameCalendarDay(timestamp, now)) {
    return t('chat.time.hoursAgo', {
      count: Math.floor(diff / ONE_HOUR_MS),
    })
  }

  const date = new Date(timestamp)
  const dateLabel = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return t('chat.time.older', { date: dateLabel, time: timeLabel })
}

const isSameCalendarDay = (first: number, second: number): boolean => {
  const firstDate = new Date(first)
  const secondDate = new Date(second)

  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
}

export const MessageBubble = ({
  message,
  isMine,
  showTimestamp,
  onImagePress,
  onLongPress,
}: MessageBubbleProps): React.JSX.Element | null => {
  const { t } = useTranslation()
  const [isImageLoading, setIsImageLoading] = useState(false)

  if (message.text === null && message.imageUrl === null) {
    return null
  }

  const timestamp = formatTimestamp(message.timestamp, t)
  const readReceiptIcon = message.read ? 'checkmark-done' : 'checkmark'
  const readReceiptColor = message.read ? colors.secondary : colors.gray[400]

  const handleImagePress = (): void => {
    if (message.imageUrl !== null) {
      onImagePress(message.imageUrl)
    }
  }

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <TouchableOpacity
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
        onLongPress={() => onLongPress(message)}
        activeOpacity={0.88}
      >
        {message.imageUrl !== null && (
          <TouchableOpacity
            style={styles.imageWrap}
            onPress={handleImagePress}
            onLongPress={() => onLongPress(message)}
            activeOpacity={0.9}
          >
            {isImageLoading && <View style={styles.imagePlaceholder} />}
            <Image
              source={{ uri: message.imageUrl }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={t('chat.imageAlt')}
              onLoadStart={() => setIsImageLoading(true)}
              onLoadEnd={() => setIsImageLoading(false)}
            />
          </TouchableOpacity>
        )}

        {message.text !== null && (
          <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
            {message.text}
          </Text>
        )}
      </TouchableOpacity>

      {showTimestamp && (
        <View
          style={[
            styles.timestampRow,
            isMine ? styles.timestampMine : styles.timestampTheirs,
          ]}
        >
          <Text style={styles.timestamp}>{timestamp}</Text>
          {isMine && (
            <Ionicons
              name={readReceiptIcon}
              size={READ_RECEIPT_SIZE}
              color={readReceiptColor}
            />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: borderRadius.sm,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
  },
  bubbleTheirs: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: BUBBLE_RADIUS,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
  },
  image: {
    borderRadius: IMAGE_RADIUS,
    height: IMAGE_SIZE,
    width: IMAGE_SIZE,
  },
  imagePlaceholder: {
    backgroundColor: colors.gray[400],
    borderRadius: IMAGE_RADIUS,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  imageWrap: {
    backgroundColor: colors.gray[200],
    borderRadius: IMAGE_RADIUS,
    overflow: 'hidden',
  },
  row: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  text: {
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.xl,
  },
  textMine: {
    color: colors.white,
  },
  textTheirs: {
    color: colors.gray[800],
  },
  timestamp: {
    color: colors.gray[400],
    fontSize: typography.sizes.xs,
  },
  timestampMine: {
    justifyContent: 'flex-end',
  },
  timestampRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timestampTheirs: {
    justifyContent: 'flex-start',
  },
})
