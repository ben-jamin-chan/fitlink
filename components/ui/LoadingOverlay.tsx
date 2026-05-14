import React from 'react'

import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export const LoadingOverlay = ({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element => (
  <Modal transparent animationType="fade" visible={visible}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message !== undefined && message !== '' && (
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
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 160,
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
