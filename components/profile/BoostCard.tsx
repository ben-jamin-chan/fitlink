import React, { useState } from 'react'

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { StackNavigationProp } from '@react-navigation/stack'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useTranslation } from 'react-i18next'

import { useProfileStore } from '@/store/profileStore'
import { showToast } from '@/store/toastStore'

import { PremiumBadge } from '@/components/ui/PremiumBadge'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import type { UserBoost } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const CALLABLE_REGION = 'asia-southeast1'
const BOOST_CALLABLE_NAME = 'activateBoost'
const MILLISECONDS_PER_MINUTE = 60_000

interface ActivateBoostResponse {
  expiresAt: number
  success: boolean
}

interface BoostCardStyles {
  actionButton: ViewStyle
  actionButtonDisabled: ViewStyle
  actionButtonText: TextStyle
  badgeRow: ViewStyle
  card: ViewStyle
  description: TextStyle
  footerRow: ViewStyle
  headerRow: ViewStyle
  icon: TextStyle
  iconWrap: ViewStyle
  status: TextStyle
  textWrap: ViewStyle
  title: TextStyle
  titleRow: ViewStyle
}

const getActiveExpiresAtMs = (
  profileExpiresAtMs: number | null,
  localExpiresAtMs: number | null
): number | null => {
  const now = Date.now()

  if (localExpiresAtMs !== null && localExpiresAtMs > now) {
    return localExpiresAtMs
  }

  if (profileExpiresAtMs !== null && profileExpiresAtMs > now) {
    return profileExpiresAtMs
  }

  return null
}

const isBoostUsedThisMonth = (
  activatedAt: UserBoost['activatedAt'] | undefined
): boolean => {
  if (activatedAt === undefined) {
    return false
  }

  const activated = activatedAt.toDate()
  const now = new Date()

  return (
    activated.getFullYear() === now.getFullYear() &&
    activated.getMonth() === now.getMonth()
  )
}

const getRemainingMinutes = (expiresAtMs: number): number => {
  const remainingMs = expiresAtMs - Date.now()

  if (remainingMs <= 0) {
    return 0
  }

  return Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE)
}

interface BoostCardProps {
  navigation: StackNavigationProp<RootStackParamList>
}

export const BoostCard = ({
  navigation,
}: BoostCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const profile = useProfileStore((state) => state.profile)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [localExpiresAtMs, setLocalExpiresAtMs] = useState<number | null>(null)

  const boost = profile?.boost
  const isProUser =
    profile !== null &&
    profile.premium.active === true &&
    profile.premium.tier === 'pro'
  const profileExpiresAtMs = boost?.expiresAt.toMillis() ?? null
  const activeExpiresAtMs = getActiveExpiresAtMs(
    profileExpiresAtMs,
    localExpiresAtMs
  )
  const isActive = activeExpiresAtMs !== null
  const usedThisMonth =
    isActive === false && isBoostUsedThisMonth(boost?.activatedAt)
  const buttonDisabled = isLoading || (isProUser && (isActive || usedThisMonth))

  const getStatusLabel = (): string => {
    if (!isProUser) {
      return t('profile.boost.proOnly')
    }

    if (activeExpiresAtMs !== null) {
      return t('profile.boost.activeTimeRemaining', {
        time: t('profile.boost.timeMinutes', {
          minutes: getRemainingMinutes(activeExpiresAtMs),
        }),
      })
    }

    if (usedThisMonth) {
      return t('profile.boost.usedThisMonth')
    }

    return t('profile.boost.available')
  }

  const handlePress = async (): Promise<void> => {
    if (!isProUser) {
      navigation.navigate('Premium')
      return
    }

    if (isActive || usedThisMonth) {
      return
    }

    setIsLoading(true)

    try {
      const functions = getFunctions(undefined, CALLABLE_REGION)
      const activateBoost = httpsCallable<
        Record<string, never>,
        ActivateBoostResponse
      >(functions, BOOST_CALLABLE_NAME)
      const result = await activateBoost({})

      setLocalExpiresAtMs(result.data.expiresAt)
      showToast(t('profile.boost.activated'), 'success')
    } catch {
      showToast(t('profile.boost.error'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="rocket-outline"
              size={spacing.lg}
              color={colors.warning}
              style={styles.icon}
            />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.badgeRow}>
              <Text style={styles.title} numberOfLines={2}>
                {t('profile.boost.title')}
              </Text>
              <PremiumBadge tier="pro" size="sm" />
            </View>
            <Text style={styles.description}>
              {t('settings.boost.description')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.status} numberOfLines={2}>
          {getStatusLabel()}
        </Text>
        <TouchableOpacity
          style={[
            styles.actionButton,
            buttonDisabled && styles.actionButtonDisabled,
          ]}
          onPress={handlePress}
          disabled={buttonDisabled}
          activeOpacity={0.8}
          accessibilityLabel={t('profile.boost.buttonLabel')}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.actionButtonText} numberOfLines={1}>
              {t('profile.boost.buttonLabel')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create<BoostCardStyles>({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    minHeight: spacing.xl,
    minWidth: spacing.xxxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.gray[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  description: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
  },
  icon: {
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    height: spacing.xl,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: spacing.xl,
  },
  status: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: colors.gray[900],
    flexShrink: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  titleRow: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
  },
})
