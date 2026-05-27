import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useStripe } from '@stripe/stripe-react-native'
import * as Linking from 'expo-linking'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import { getCurrency, getStripePrices } from '@/services/stripe'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import type { PremiumTier, StripePrice } from '@/types/subscription'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const ACTIVE_PLAN_ICON_SIZE = spacing.xxl
const DEFAULT_COUNTRY = 'Malaysia'
const FEATURE_ICON_SIZE = spacing.md
const HERO_ICON_SIZE = spacing.xxxl + spacing.lg
const HERO_HEART_SIZE = spacing.xxl + spacing.sm
const PORTAL_URL = 'https://billing.stripe.com/p/login/test_placeholder'
const SELECTED_CARD_ELEVATION = spacing.xs
const SELECTED_CARD_SHADOW_OPACITY = 0.25
const SUCCESS_FEATURE_ICON_SIZE = typography.sizes.lg
const SUCCESS_ICON_SIZE = spacing.xxxl
const TERMS_URL = 'https://fitlink.app/terms'

const BILLING_INTERVALS: StripePrice['interval'][] = [
  'month',
  '3month',
  '6month',
]

const PLUS_FEATURES: readonly string[] = [
  'subscription.features.unlimitedLikes',
  'subscription.features.seeWhoLiked',
  'subscription.features.fiveSuperLikes',
  'subscription.features.advancedFilters',
  'subscription.features.rewind',
  'subscription.features.noAds',
]

const PRO_FEATURES: readonly string[] = [
  'subscription.features.everythingInPlus',
  'subscription.features.priorityProfile',
  'subscription.features.readReceipts',
  'subscription.features.unlimitedSuperLikes',
  'subscription.features.incognito',
  'subscription.features.monthlyBoost',
]

const getTierLabelKey = (tier: PremiumTier): string =>
  tier === 'pro' ? 'subscription.tier.pro' : 'subscription.tier.plus'

type PremiumNavigationProp = StackNavigationProp<RootStackParamList, 'Premium'>

export default function PremiumScreen(): React.JSX.Element {
  const { i18n, t } = useTranslation()
  const navigation = useNavigation<PremiumNavigationProp>()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const user = useAuthStore((state) => state.user)
  const selectedTier = useSubscriptionStore((state) => state.selectedTier)
  const selectedInterval = useSubscriptionStore(
    (state) => state.selectedInterval
  )
  const isLoading = useSubscriptionStore((state) => state.isLoading)
  const error = useSubscriptionStore((state) => state.error)
  const pendingClientSecret = useSubscriptionStore(
    (state) => state.pendingClientSecret
  )
  const setSelectedTier = useSubscriptionStore(
    (state) => state.setSelectedTier
  )
  const setSelectedInterval = useSubscriptionStore(
    (state) => state.setSelectedInterval
  )
  const beginSubscription = useSubscriptionStore(
    (state) => state.beginSubscription
  )
  const clearPendingClientSecret = useSubscriptionStore(
    (state) => state.onPaymentComplete
  )
  const isPremium = useSubscriptionStore((state) => state.isPremium)
  const profile = useProfileStore((state) => state.profile)
  const [isSheetLoading, setIsSheetLoading] = useState<boolean>(false)
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false)

  const country = profile?.location.country ?? DEFAULT_COUNTRY
  const prices = useMemo(() => getStripePrices(country), [country])
  const currency = getCurrency(country)
  const selectedPriceEntry = prices[selectedTier][selectedInterval]
  const isPaymentReady = pendingClientSecret !== null

  const getDisplayPrice = useCallback(
    (tier: PremiumTier): string => {
      const price = prices[tier][selectedInterval]

      return price.amountDisplay.length > 0
        ? price.amountDisplay
        : t('subscription.priceUnavailable')
    },
    [prices, selectedInterval, t]
  )

  const getSavingsLabel = (
    interval: StripePrice['interval']
  ): string | null => {
    if (interval === '3month') {
      return t('subscription.save', {
        percent: t('subscription.savingsPercent.3month'),
      })
    }

    if (interval === '6month') {
      return t('subscription.save', {
        percent: t('subscription.savingsPercent.6month'),
      })
    }

    return null
  }

  const getBilledAs = (tier: PremiumTier): string => {
    const price = prices[tier][selectedInterval]

    if (selectedInterval === 'month') {
      return t('subscription.billedMonthly')
    }

    return t('subscription.billedEveryPeriod', {
      amount: `${currency} ${price.amountDisplay}`,
      period:
        selectedInterval === '3month'
          ? t('subscription.billedEvery3Months')
          : t('subscription.billedEvery6Months'),
    })
  }

  const handleSubscribe = useCallback(async (): Promise<void> => {
    try {
      const didBeginSubscription = await beginSubscription(country)

      if (didBeginSubscription) {
        return
      }

      const errorKey =
        useSubscriptionStore.getState().error ?? 'subscription.errors.generic'

      Alert.alert(t('subscription.error.title'), t(errorKey), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.tryAgain'),
          onPress: () => {
            void beginSubscription(country)
          },
        },
      ])
    } catch {
      Alert.alert(t('subscription.error.title'), t('subscription.error.generic'))
    }
  }, [beginSubscription, country, t])

  useEffect(() => {
    if (pendingClientSecret === null) {
      return
    }

    const openPaymentSheet = async (): Promise<void> => {
      try {
        setIsSheetLoading(true)

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'fitlink',
          paymentIntentClientSecret: pendingClientSecret,
          allowsDelayedPaymentMethods: true,
          returnURL: 'fitlink://payment-complete',
          appearance: {
            colors: {
              primary: colors.primary,
            },
          },
          defaultBillingDetails: {
            email: user?.email ?? undefined,
          },
        })

        setIsSheetLoading(false)

        if (initError) {
          clearPendingClientSecret()
          Alert.alert(
            t('subscription.error.title'),
            t('subscription.error.initFailed'),
            [{ text: t('common.close') }]
          )
          return
        }

        const { error: presentError } = await presentPaymentSheet()

        clearPendingClientSecret()

        if (presentError) {
          if (presentError.code !== 'Canceled') {
            Alert.alert(
              t('subscription.error.title'),
              t('subscription.errors.paymentFailed'),
              [
                { text: t('subscription.error.retry'), onPress: handleSubscribe },
                { text: t('common.cancel'), style: 'cancel' },
              ]
            )
          }
          return
        }

        setShowSuccessModal(true)
      } catch {
        setIsSheetLoading(false)
        clearPendingClientSecret()
        Alert.alert(
          t('subscription.error.title'),
          t('subscription.errors.paymentFailed'),
          [
            { text: t('subscription.error.retry'), onPress: handleSubscribe },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        )
      }
    }

    void openPaymentSheet()
  }, [pendingClientSecret]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleDeepLink = (event: Linking.EventType): void => {
      if (event.url.startsWith('fitlink://payment-complete')) {
        setShowSuccessModal(true)
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink)
    return () => subscription.remove()
  }, [])

  const handleManageSubscription = useCallback((): void => {
    void Linking.openURL(PORTAL_URL).catch(() => {
      Alert.alert(t('errors.generic'))
    })
  }, [t])

  const handleOpenTerms = useCallback((): void => {
    void Linking.openURL(TERMS_URL).catch(() => {
      Alert.alert(t('errors.generic'))
    })
  }, [t])

  const successModal = (
    <Modal
      visible={showSuccessModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <Ionicons
            name="checkmark-circle"
            size={SUCCESS_ICON_SIZE}
            color={colors.primary}
            style={styles.successIcon}
          />

          <Text style={styles.successHeadline}>
            {t('subscription.success.headline')}
          </Text>

          <Text style={styles.successSubheadline}>
            {t('subscription.success.subheadline')}
          </Text>

          <View style={styles.successFeatures}>
            {[
              t('subscription.success.feature1'),
              t('subscription.success.feature2'),
              t('subscription.success.feature3'),
              t('subscription.success.feature4'),
            ].map((feature) => (
              <View key={feature} style={styles.successFeatureRow}>
                <Ionicons
                  name="checkmark"
                  size={SUCCESS_FEATURE_ICON_SIZE}
                  color={colors.primary}
                />
                <Text style={styles.successFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <Button
            label={t('subscription.success.cta')}
            variant="primary"
            onPress={() => {
              setShowSuccessModal(false)
              navigation.goBack()
            }}
          />
        </View>
      </View>
    </Modal>
  )

  if (profile !== null && isPremium() && profile.premium.tier !== null) {
    const renewalDate =
      profile.premium.expiresAt !== null
        ? profile.premium.expiresAt.toDate().toLocaleDateString(i18n.language, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : null
    const tierLabel = t(getTierLabelKey(profile.premium.tier))

    return (
      <>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        >
          <LoadingOverlay
            visible={isLoading}
            message={t('subscription.loading')}
          />

          <View style={styles.activePlanCard}>
            <Ionicons
              name="checkmark-circle"
              size={ACTIVE_PLAN_ICON_SIZE}
              color={colors.primary}
            />
            <Text style={styles.activePlanHeadline}>
              {t('subscription.activePlan.title')}
            </Text>
            <Text style={styles.activeTierName}>
              {t('subscription.activePlan.planName', { tier: tierLabel })}
            </Text>
            {renewalDate !== null && (
              <Text style={styles.renewalDate}>
                {t('subscription.activePlan.renewsOn', { date: renewalDate })}
              </Text>
            )}
          </View>

          <Button
            label={t('subscription.activePlan.manage')}
            variant="outline"
            onPress={handleManageSubscription}
          />

          <Text style={styles.legalText}>
            {t('subscription.legal.cancelAnytime')}
          </Text>
        </ScrollView>
        <LoadingOverlay
          visible={isSheetLoading}
          message={t('subscription.sheet.loading')}
        />
        {successModal}
      </>
    )
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <LoadingOverlay visible={isLoading} message={t('subscription.loading')} />

        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons
              name="heart"
              size={HERO_HEART_SIZE}
              color={colors.primary}
            />
          </View>
          <Text style={styles.heroHeadline}>
            {t('subscription.hero.headline')}
          </Text>
          <Text style={styles.heroSubheadline}>
            {t('subscription.hero.subheadline')}
          </Text>
        </View>

        <View style={styles.intervalSelector}>
          {BILLING_INTERVALS.map((interval) => {
            const savings = getSavingsLabel(interval)
            const isActive = selectedInterval === interval

            return (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalTab,
                  isActive && styles.intervalTabActive,
                ]}
                onPress={() => setSelectedInterval(interval)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.intervalTabLabel,
                    isActive && styles.intervalTabLabelActive,
                  ]}
                >
                  {t(`subscription.interval.${interval}`)}
                </Text>
                {savings !== null && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeLabel}>{savings}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.planCards}>
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedTier === 'plus' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedTier('plus')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.planCardName}>
              {t('subscription.tier.plus')}
            </Text>
            <Text style={styles.planCardPrice}>{getDisplayPrice('plus')}</Text>
            <Text style={styles.planCardBilledAs}>{getBilledAs('plus')}</Text>
            <View style={styles.featureDivider} />
            {PLUS_FEATURES.map((key) => (
              <View key={key} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={FEATURE_ICON_SIZE}
                  color={colors.primary}
                />
                <Text style={styles.featureLabel}>{t(key)}</Text>
              </View>
            ))}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.planCard,
              styles.planCardPro,
              selectedTier === 'pro' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedTier('pro')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.mostPopularBadge}>
              <Text style={styles.mostPopularLabel}>
                {t('subscription.tier.mostPopular')}
              </Text>
            </View>
            <Text style={styles.planCardName}>{t('subscription.tier.pro')}</Text>
            <Text style={styles.planCardPrice}>{getDisplayPrice('pro')}</Text>
            <Text style={styles.planCardBilledAs}>{getBilledAs('pro')}</Text>
            <View style={styles.featureDivider} />
            {PRO_FEATURES.map((key) => (
              <View key={key} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={FEATURE_ICON_SIZE}
                  color={colors.primary}
                />
                <Text style={styles.featureLabel}>{t(key)}</Text>
              </View>
            ))}
          </TouchableOpacity>
        </View>

        {error !== null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{t(error)}</Text>
          </View>
        )}

        {isPaymentReady && (
          <Text style={styles.readyText}>{t('subscription.readyToPay')}</Text>
        )}

        <View style={styles.subscribeButtonContainer}>
          <Button
            label={t('subscription.subscribeFor', {
              price: `${currency} ${selectedPriceEntry.amountDisplay}`,
            })}
            variant="primary"
            onPress={handleSubscribe}
            loading={isLoading}
            disabled={isLoading || isPaymentReady}
          />
        </View>

        <Text style={styles.legalText}>
          {t('subscription.legal.autoRenews')}
        </Text>
        <TouchableOpacity
          onPress={handleOpenTerms}
          accessibilityRole="link"
          style={styles.legalLinkButton}
        >
          <Text style={styles.legalLink}>{t('settings.terms')}</Text>
        </TouchableOpacity>
      </ScrollView>
      <LoadingOverlay
        visible={isSheetLoading}
        message={t('subscription.sheet.loading')}
      />
      {successModal}
    </>
  )
}

const styles = StyleSheet.create({
  activePlanCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderWidth: spacing.xs / 2,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  activePlanHeadline: {
    color: colors.gray[800],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  activeTierName: {
    color: colors.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  errorBanner: {
    backgroundColor: colors.gray[100],
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    borderWidth: spacing.xs / 4,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  featureDivider: {
    backgroundColor: colors.gray[200],
    height: spacing.xs / 4,
    marginBottom: spacing.sm,
  },
  featureLabel: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.lg,
  },
  featureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  heroHeadline: {
    color: colors.gray[800],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  heroIconContainer: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: HERO_ICON_SIZE / 2,
    height: HERO_ICON_SIZE,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: HERO_ICON_SIZE,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroSubheadline: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },
  intervalSelector: {
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: spacing.xs / 4,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  intervalTab: {
    alignItems: 'center',
    backgroundColor: colors.white,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  intervalTabActive: {
    backgroundColor: colors.primary,
  },
  intervalTabLabel: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  intervalTabLabelActive: {
    color: colors.white,
  },
  legalLink: {
    color: colors.secondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  legalLinkButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  legalText: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  mostPopularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
  },
  mostPopularLabel: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  planCard: {
    backgroundColor: colors.white,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: spacing.xs / 2,
    padding: spacing.md,
  },
  planCardBilledAs: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
    marginBottom: spacing.sm,
  },
  planCardName: {
    color: colors.gray[800],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  planCardPrice: {
    color: colors.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  planCardPro: {
    borderColor: colors.primary,
  },
  planCardSelected: {
    borderColor: colors.primary,
    elevation: SELECTED_CARD_ELEVATION,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: spacing.xs / 2 },
    shadowOpacity: SELECTED_CARD_SHADOW_OPACITY,
    shadowRadius: spacing.sm,
  },
  planCards: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  readyText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  renewalDate: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  savingsBadge: {
    backgroundColor: colors.warning,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 4,
  },
  savingsBadgeLabel: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  subscribeButtonContainer: {
    marginBottom: spacing.md,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  successFeatureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  successFeatureText: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
  },
  successFeatures: {
    marginBottom: spacing.xl,
    width: '100%',
  },
  successHeadline: {
    color: colors.gray[800],
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  successOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  successSubheadline: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
})
