import React from 'react'

import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const CARD_MIN_WIDTH = spacing.xxxl + spacing.xxxl
const CARD_ELEVATION = 8
const CARD_SHADOW_OPACITY = 0.15
const MESSAGE_MAX_WIDTH = spacing.xxxl + spacing.xxxl + spacing.xl + spacing.md

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export const LoadingOverlay = ({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element => (
  <Modal
    transparent
    animationType="fade"
    visible={visible}
    statusBarTranslucent
  >
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message !== undefined && message.length > 0 && (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>
    </View>
  </Modal>
)

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minWidth: CARD_MIN_WIDTH,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: spacing.xs },
    shadowOpacity: CARD_SHADOW_OPACITY,
    shadowRadius: spacing.sm,
    elevation: CARD_ELEVATION,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    maxWidth: MESSAGE_MAX_WIDTH,
  },
})
