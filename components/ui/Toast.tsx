import React, { useEffect, useRef } from 'react'

import {
  Animated,
  StyleSheet,
  Text,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useToastStore } from '@/store/toastStore'
import type { ToastType } from '@/store/toastStore'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const TOAST_DURATION_MS = 3000
const ANIMATION_DURATION_MS = 250
const TOAST_HIDDEN_OFFSET = -150
const TOAST_ICON_SIZE = 20
const TOAST_Z_INDEX = 9999
const TOAST_ELEVATION = 10
const TOAST_SHADOW_OPACITY = 0.25

type ToastIconName = React.ComponentProps<typeof Ionicons>['name']

interface ToastConfig {
  icon: ToastIconName
  iconColor: string
}

const TOAST_CONFIG: Record<ToastType, ToastConfig> = {
  success: {
    icon: 'checkmark-circle',
    iconColor: colors.white,
  },
  error: {
    icon: 'alert-circle',
    iconColor: colors.white,
  },
  info: {
    icon: 'information-circle',
    iconColor: colors.white,
  },
}

export const Toast = (): React.JSX.Element => {
  const insets = useSafeAreaInsets()
  const { visible, message, type, sequence, hideToast } = useToastStore()
  const translateY = useRef(new Animated.Value(TOAST_HIDDEN_OFFSET)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animatedStyle = {
    transform: [{ translateY }],
  }
  const positionStyle = {
    top: insets.top + spacing.sm,
  }

  useEffect(() => {
    if (visible) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start()

      timerRef.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: TOAST_HIDDEN_OFFSET,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }).start(() => hideToast())
      }, TOAST_DURATION_MS)
    } else {
      translateY.setValue(TOAST_HIDDEN_OFFSET)
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [hideToast, message, sequence, translateY, type, visible])

  const config = TOAST_CONFIG[type]

  if (!visible) {
    return <></>
  }

  return (
    <Animated.View style={[styles.container, toastTypeStyles[type], positionStyle, animatedStyle]}>
      <Ionicons
        name={config.icon}
        size={TOAST_ICON_SIZE}
        color={config.iconColor}
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  )
}

const toastTypeStyles = StyleSheet.create({
  success: {
    backgroundColor: colors.primary,
  },
  error: {
    backgroundColor: colors.danger,
  },
  info: {
    backgroundColor: colors.gray[800],
  },
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: TOAST_Z_INDEX,
    elevation: TOAST_ELEVATION,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: spacing.xs },
    shadowOpacity: TOAST_SHADOW_OPACITY,
    shadowRadius: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
  },
})
