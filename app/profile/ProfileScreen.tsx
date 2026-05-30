import React, { useState } from 'react'

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ColorValue } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'

import { ActivityChip } from '@/components/profile/ActivityChip'
import { InfoCard, InfoRow } from '@/components/profile/InfoCard'
import { PhotoGrid } from '@/components/profile/PhotoGrid'
import { StatsBadge } from '@/components/profile/StatsBadge'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import type { ProfileStackParamList } from '@/app/navigation/MainTabNavigator'
import type { DrinkingStatus, FitnessLevel, SmokingStatus } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type ProfileNavigationProp = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'Profile'>,
  StackNavigationProp<RootStackParamList>
>

const BIO_PREVIEW_LENGTH = 200
const DAY_IN_MS = 1000 * 60 * 60 * 24
const HERO_ASPECT_RATIO = 16 / 9
const HERO_GRADIENT_END = 'rgba(0, 0, 0, 0.75)'
const HERO_GRADIENT_COLORS: [ColorValue, ColorValue] = [
  colors.transparent,
  HERO_GRADIENT_END,
]

const editHitSlop = {
  bottom: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
  top: spacing.sm,
}

const getDaysActiveValue = (
  createdAt: { toDate: () => Date } | undefined,
  unavailableLabel: string,
): number | string => {
  if (createdAt === undefined) {
    return unavailableLabel
  }

  const diffMs = Date.now() - createdAt.toDate().getTime()

  return Math.max(0, Math.round(diffMs / DAY_IN_MS))
}

const getFitnessLevelKey = (fitnessLevel: FitnessLevel): string => {
  return `onboarding.step3.fitnessLevelOptions.${fitnessLevel}`
}

const getSmokingKey = (smoking: SmokingStatus): string => {
  return `onboarding.step4.smoking.options.${smoking}`
}

const getDrinkingKey = (drinking: DrinkingStatus): string => {
  return `onboarding.step4.drinking.options.${drinking}`
}

export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<ProfileNavigationProp>()
  const userId = useAuthStore((state) => state.user?.uid)
  const profile = useProfileStore((state) => state.profile)
  const isLoading = useProfileStore((state) => state.isLoading)
  const error = useProfileStore((state) => state.error)
  const fetchProfile = useProfileStore((state) => state.fetchProfile)
  const [bioExpanded, setBioExpanded] = useState(false)

  const handleEditProfile = (): void => {
    navigation.navigate('EditProfile')
  }

  const handleSettings = (): void => {
    navigation.navigate('Settings')
  }

  const handleRetry = (): void => {
    if (userId === undefined) {
      return
    }

    void fetchProfile(userId)
  }

  const handleVerifyProfile = (): void => {
    navigation.navigate('PhotoVerification')
  }

  const handleGetPremium = (): void => {
    // TODO Phase 2: navigate to PremiumScreen.
  }

  if (error !== null && profile === null && !isLoading) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{t(error)}</Text>
        <View style={styles.retryButton}>
          <Button
            label={t('profile.retry')}
            onPress={handleRetry}
            disabled={userId === undefined}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (isLoading || profile === null) {
    return <LoadingOverlay visible={true} />
  }

  const primaryPhoto = profile.photos[0]
  const daysActive = getDaysActiveValue(
    profile.createdAt,
    t('profile.unavailable'),
  )
  const isBioLong = profile.bio.length > BIO_PREVIEW_LENGTH
  const bioText =
    bioExpanded || !isBioLong
      ? profile.bio
      : t('profile.bioTruncated', {
          bio: profile.bio.slice(0, BIO_PREVIEW_LENGTH),
        })
  const locationLabel = `${profile.location.city}, ${profile.location.country}`
  const religionLabel =
    profile.religion !== undefined && profile.religion !== ''
      ? profile.religion
      : t('profile.notSpecified')
  const fitnessLevelLabel = t(getFitnessLevelKey(profile.fitnessLevel))
  const smokingLabel = t(getSmokingKey(profile.smoking))
  const drinkingLabel = t(getDrinkingKey(profile.drinking))
  const goalsLabel =
    profile.fitnessGoals.length > 0
      ? profile.fitnessGoals.join(', ')
      : t('profile.notSpecified')

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroContainer}>
          {primaryPhoto !== undefined ? (
            <Image source={{ uri: primaryPhoto }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons
                name="person-circle-outline"
                size={spacing.xxxl}
                color={colors.gray[300]}
              />
            </View>
          )}
          <LinearGradient
            colors={HERO_GRADIENT_COLORS}
            style={styles.heroGradient}
          />
          <TouchableOpacity
            style={styles.heroEditButton}
            onPress={handleEditProfile}
            hitSlop={editHitSlop}
            activeOpacity={0.75}
            accessibilityLabel={t('profile.editProfile')}
          >
            <Ionicons
              name="pencil-outline"
              size={spacing.lg}
              color={colors.white}
            />
          </TouchableOpacity>
          <View style={styles.heroTextContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.heroName}>
                {profile.firstName}, {profile.age}
              </Text>
              {profile.photoVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={spacing.lg}
                  color={colors.secondary}
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            <Text style={styles.heroLocation}>{profile.location.city}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statsRow}>
            <StatsBadge
              value={profile.stats.matches}
              label={t('profile.matches')}
            />
            <View style={styles.statsDivider} />
            <StatsBadge
              value={profile.stats.likes}
              label={t('profile.likes')}
            />
            <View style={styles.statsDivider} />
            <StatsBadge value={daysActive} label={t('profile.daysActive')} />
          </View>

          <View style={styles.photoGridContainer}>
            <PhotoGrid photoUris={profile.photos} readOnly={true} />
          </View>

          {profile.photoVerified === false && (
            <View style={styles.verificationCard}>
              <View style={styles.verificationIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={spacing.xl}
                  color={colors.secondary}
                />
              </View>
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>
                  {t('profile.verifyTitle')}
                </Text>
                <Text style={styles.verificationSubtitle}>
                  {t('profile.verifySubtitle')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleVerifyProfile}
                activeOpacity={0.8}
                accessibilityLabel={t('profile.verifyNow')}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('profile.verifyNow')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <InfoCard title={t('profile.about.title')}>
            <Text style={styles.bioText}>
              {bioText}
              {isBioLong && (
                <Text
                  style={styles.readMoreText}
                  onPress={() => setBioExpanded((expanded) => !expanded)}
                >
                  {bioExpanded ? t('profile.readLess') : t('profile.readMore')}
                </Text>
              )}
            </Text>
          </InfoCard>

          <InfoCard title={t('profile.basicInfo')} onEdit={handleEditProfile}>
            <InfoRow
              icon="resize-outline"
              label={t('profile.height')}
              value={t('profile.heightCm', { height: profile.height })}
            />
            <InfoRow
              icon="location-outline"
              label={t('profile.location')}
              value={locationLabel}
            />
            <InfoRow
              icon="sparkles-outline"
              label={t('profile.religion')}
              value={religionLabel}
            />
          </InfoCard>

          <InfoCard
            title={t('profile.fitnessProfile')}
            onEdit={handleEditProfile}
          >
            {profile.activities.length > 0 ? (
              <View style={styles.activityChips}>
                {profile.activities.map((activity: string) => (
                  <ActivityChip key={activity} label={activity} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyValue}>{t('profile.notSpecified')}</Text>
            )}
            <InfoRow
              icon="barbell-outline"
              label={t('profile.level')}
              value={fitnessLevelLabel}
            />
            <InfoRow
              icon="calendar-outline"
              label={t('profile.frequency')}
              value={profile.workoutFrequency}
            />
            <InfoRow
              icon="flag-outline"
              label={t('profile.goals')}
              value={goalsLabel}
            />
          </InfoCard>

          <InfoCard
            title={t('profile.sections.lifestyle')}
            onEdit={handleEditProfile}
          >
            <InfoRow
              icon="restaurant-outline"
              label={t('profile.diet')}
              value={profile.dietaryPreference}
            />
            <InfoRow
              icon="flame-outline"
              label={t('profile.smoking')}
              value={smokingLabel}
            />
            <InfoRow
              icon="wine-outline"
              label={t('profile.drinking')}
              value={drinkingLabel}
            />
          </InfoCard>

          <View style={styles.actionButtons}>
            <Button
              label={t('profile.editProfile')}
              onPress={handleEditProfile}
            />
            <Button
              label={t('profile.settings')}
              onPress={handleSettings}
              variant="outline"
            />
            {profile.premium.active === false && (
              <TouchableOpacity
                style={styles.premiumButton}
                onPress={handleGetPremium}
                activeOpacity={0.8}
                accessibilityLabel={t('profile.getPremium')}
              >
                <Text style={styles.premiumButtonText}>
                  {t('profile.getPremium')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButtons: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  activityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  bioText: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  emptyValue: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  heroContainer: {
    aspectRatio: HERO_ASPECT_RATIO,
    backgroundColor: colors.gray[200],
    position: 'relative',
    width: '100%',
  },
  heroEditButton: {
    alignItems: 'center',
    backgroundColor: colors.overlayLight,
    borderRadius: borderRadius.full,
    height: spacing.xxl,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: spacing.xxl,
  },
  heroFallback: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    flex: 1,
    justifyContent: 'center',
  },
  heroGradient: {
    bottom: 0,
    height: '40%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroLocation: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  heroName: {
    color: colors.white,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  heroTextContainer: {
    bottom: spacing.md,
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  photoGridContainer: {
    marginBottom: spacing.md,
  },
  premiumButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    height: spacing.xxxl - spacing.md + spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  premiumButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  readMoreText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  retryButton: {
    width: '100%',
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: colors.background,
  },
  scrollView: {
    backgroundColor: colors.background,
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    height: spacing.xxl,
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  statsDivider: {
    alignSelf: 'center',
    backgroundColor: colors.gray[200],
    height: spacing.xl,
    width: StyleSheet.hairlineWidth,
  },
  statsRow: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  verificationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  verificationCopy: {
    flex: 1,
  },
  verificationIcon: {
    marginBottom: spacing.sm,
  },
  verificationSubtitle: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  verificationTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  verifiedIcon: {
    marginLeft: spacing.xs,
  },
})
