import React from 'react'

import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'

import { useDiscoveryStore } from '@/store/discoveryStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { showToast } from '@/store/toastStore'

import { colors, spacing } from '@/constants/theme'

const BUTTON_LG = 56
const BUTTON_SM = 46
const ICON_LG = 30
const ICON_SM = 24
const SHADOW_ELEVATION = 4

type ActionButtonKind = 'rewind' | 'pass' | 'superLike' | 'like' | 'info'
type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface ActionButtonConfig {
  kind: ActionButtonKind
  icon: IoniconName
  color: string
  size: 'large' | 'small'
  onPress: () => void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getErrorCode = (error: unknown): string | null => {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return null
  }

  return error.code
}

const isRewindNoSwipesError = (error: unknown): boolean =>
  isRecord(error) &&
  isRecord(error.details) &&
  getErrorCode(error) === 'functions/not-found' &&
  error.details.reason === 'no-swipes'

const getRewindErrorMessageKey = (error: unknown): string => {
  if (isRewindNoSwipesError(error)) {
    return 'discovery.rewind.noSwipes'
  }

  if (getErrorCode(error) === 'functions/permission-denied') {
    return 'discovery.rewind.notAvailable'
  }

  return 'discovery.rewind.error'
}

interface ActionButtonsProps {
  onPass: () => void
  onLike: () => void
  onSuperLike: () => void
  onInfo: () => void
  disabled: boolean
  rewindDisabled: boolean
}

export const ActionButtons = ({
  onPass,
  onLike,
  onSuperLike,
  onInfo,
  disabled,
  rewindDisabled,
}: ActionButtonsProps): React.JSX.Element => {
  const { t } = useTranslation()
  const rewind = useDiscoveryStore((state) => state.rewind)
  const isRewinding = useDiscoveryStore((state) => state.isRewinding)
  const isPremium = useSubscriptionStore((state) => state.isPremium)
  const showUpsell = useSubscriptionStore((state) => state.showUpsell)

  const triggerHaptics = (kind: ActionButtonKind): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (kind === 'pass' || kind === 'like') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  const handlePress = (config: ActionButtonConfig): void => {
    triggerHaptics(config.kind)
    config.onPress()
  }

  const handleRewind = (): void => {
    if (!isPremium()) {
      showUpsell('rewind')
      return
    }

    void rewind().catch((error: unknown): void => {
      showToast(t(getRewindErrorMessageKey(error)), 'error')
    })
  }

  const buttons: ActionButtonConfig[] = [
    {
      kind: 'rewind',
      icon: 'reload-outline',
      color: colors.warning,
      size: 'small',
      onPress: handleRewind,
    },
    {
      kind: 'pass',
      icon: 'close',
      color: colors.danger,
      size: 'large',
      onPress: onPass,
    },
    {
      kind: 'superLike',
      icon: 'star',
      color: colors.secondary,
      size: 'small',
      onPress: onSuperLike,
    },
    {
      kind: 'like',
      icon: 'heart',
      color: colors.primary,
      size: 'large',
      onPress: onLike,
    },
    {
      kind: 'info',
      icon: 'information-circle-outline',
      color: colors.info,
      size: 'small',
      onPress: onInfo,
    },
  ]

  return (
    <View style={styles.container}>
      {buttons.map((button) => {
        const isLarge = button.size === 'large'
        const isDisabled =
          button.kind === 'rewind'
            ? rewindDisabled || isRewinding
            : disabled || isRewinding

        return (
          <TouchableOpacity
            key={button.kind}
            style={[
              styles.button,
              isLarge ? styles.buttonLarge : styles.buttonSmall,
              isDisabled && styles.disabled,
            ]}
            onPress={() => handlePress(button)}
            activeOpacity={0.82}
            disabled={isDisabled}
          >
            <Ionicons
              name={button.icon}
              size={isLarge ? ICON_LG : ICON_SM}
              color={button.color}
            />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.white,
    elevation: SHADOW_ELEVATION,
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      height: spacing.xs,
      width: 0,
    },
    shadowOpacity: 0.16,
    shadowRadius: spacing.sm,
  },
  buttonLarge: {
    borderRadius: BUTTON_LG / 2,
    height: BUTTON_LG,
    width: BUTTON_LG,
  },
  buttonSmall: {
    borderRadius: BUTTON_SM / 2,
    height: BUTTON_SM,
    width: BUTTON_SM,
  },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
})
