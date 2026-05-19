import React, { useEffect, useState } from 'react'

import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const INPUT_LINE_HEIGHT = typography.sizes.md + spacing.xs
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * 4 + spacing.md
const INPUT_MIN_HEIGHT = spacing.xxl
const ICON_BUTTON_SIZE = spacing.xxl
const SEND_ICON_SIZE = typography.sizes.xl - spacing.xs / 2
const IMAGE_ICON_SIZE = typography.sizes.xl

interface ChatInputProps {
  onSendText: (text: string) => void
  onImagePress: () => void
  onTyping: () => void
  disabled?: boolean
  prefillText?: string | null
  onPrefillUsed?: () => void
}

export const ChatInput = ({
  onSendText,
  onImagePress,
  onTyping,
  disabled = false,
  prefillText = null,
  onPrefillUsed,
}: ChatInputProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const trimmedText = text.trim()
  const canSend = trimmedText.length > 0 && !disabled
  const sendIconColor = canSend ? colors.primary : colors.gray[300]

  useEffect(() => {
    if (prefillText === null) {
      return
    }

    setText(prefillText)
    onPrefillUsed?.()
  }, [onPrefillUsed, prefillText])

  const handleChangeText = (nextText: string): void => {
    setText(nextText)
    onTyping()
  }

  const handleSend = (): void => {
    if (!canSend) {
      return
    }

    onSendText(trimmedText)
    setText('')
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.iconButton, disabled && styles.disabled]}
        onPress={onImagePress}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityLabel={t('chat.attachImage')}
      >
        <Ionicons
          name="image-outline"
          size={IMAGE_ICON_SIZE}
          color={colors.gray[600]}
        />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleChangeText}
        placeholder={t('chat.placeholder')}
        placeholderTextColor={colors.gray[400]}
        multiline
        maxLength={1000}
        scrollEnabled
        returnKeyType="default"
        editable={!disabled}
        textAlignVertical="center"
      />

      <TouchableOpacity
        style={[styles.iconButton, !canSend && styles.disabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.75}
        accessibilityLabel={t('chat.send')}
      >
        <Ionicons name="send" size={SEND_ICON_SIZE} color={sendIconColor} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  iconButton: {
    alignItems: 'center',
    height: ICON_BUTTON_SIZE,
    justifyContent: 'center',
    width: ICON_BUTTON_SIZE,
  },
  input: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.xl,
    color: colors.gray[900],
    flex: 1,
    fontSize: typography.sizes.md,
    lineHeight: INPUT_LINE_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: INPUT_MIN_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
})
