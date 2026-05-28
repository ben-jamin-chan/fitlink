import React from 'react'

import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { colors, spacing } from '@/constants/theme'

const BUTTON_LG = 56
const BUTTON_SM = 46
const ICON_LG = 30
const ICON_SM = 24
const SHADOW_ELEVATION = 4

type ActionButtonKind = 'rewind' | 'pass' | 'superLike' | 'like' | 'info'
type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface ActionButtonsProps {
  onPass: () => void
  onLike: () => void
  onSuperLike: () => void
  onRewind: () => void
  onInfo: () => void
  disabled: boolean
}

interface ActionButtonConfig {
  kind: ActionButtonKind
  icon: IoniconName
  color: string
  size: 'large' | 'small'
  onPress: () => void
}

export const ActionButtons = ({
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  onInfo,
  disabled,
}: ActionButtonsProps): React.JSX.Element => {
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

  const buttons: ActionButtonConfig[] = [
    {
      kind: 'rewind',
      icon: 'reload-outline',
      color: colors.warning,
      size: 'small',
      onPress: onRewind,
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
    <View style={[styles.container, disabled && styles.disabled]}>
      {buttons.map((button) => {
        const isLarge = button.size === 'large'

        return (
          <TouchableOpacity
            key={button.kind}
            style={[
              styles.button,
              isLarge ? styles.buttonLarge : styles.buttonSmall,
            ]}
            onPress={() => handlePress(button)}
            activeOpacity={0.82}
            disabled={disabled}
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
