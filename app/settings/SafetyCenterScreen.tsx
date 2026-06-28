import React, { useState } from 'react'

import {
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useProfileStore } from '@/store/profileStore'

import type {
  MainTabParamList,
  SettingsStackParamList,
} from '@/app/navigation/MainTabNavigator'
import {
  EMERGENCY_NUMBERS,
  FALLBACK_COUNTRY,
} from '@/constants/safetyResources'
import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type SafetyCenterNavigationProp = CompositeNavigationProp<
  StackNavigationProp<SettingsStackParamList, 'SafetyCenter'>,
  BottomTabNavigationProp<MainTabParamList>
>

interface Tip {
  titleKey: string
  bodyKey: string
}

interface TipCardProps {
  tip: Tip
}

const TIPS: Tip[] = [
  {
    titleKey: 'safety.tips.publicPlaces.title',
    bodyKey: 'safety.tips.publicPlaces.body',
  },
  {
    titleKey: 'safety.tips.personalInfo.title',
    bodyKey: 'safety.tips.personalInfo.body',
  },
  {
    titleKey: 'safety.tips.instincts.title',
    bodyKey: 'safety.tips.instincts.body',
  },
  {
    titleKey: 'safety.tips.redFlags.title',
    bodyKey: 'safety.tips.redFlags.body',
  },
  {
    titleKey: 'safety.tips.stayAlert.title',
    bodyKey: 'safety.tips.stayAlert.body',
  },
]
const GUIDELINES_URL = 'https://fitlink.app/guidelines'
const SUPPORT_MAILTO_URL = 'mailto:support@fitlink.app'
const SECTION_ICON_SIZE = spacing.lg

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental !== undefined
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const TipCard = ({ tip }: TipCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const handlePress = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded((current: boolean): boolean => !current)
  }

  return (
    <Pressable
      style={styles.tipCard}
      onPress={handlePress}
      accessibilityRole="button"
    >
      <View style={styles.tipHeader}>
        <Text style={styles.tipTitle}>{t(tip.titleKey)}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={SECTION_ICON_SIZE}
          color={colors.gray[400]}
        />
      </View>
      {isExpanded && (
        <Text style={styles.tipBody}>{t(tip.bodyKey)}</Text>
      )}
    </Pressable>
  )
}

export default function SafetyCenterScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<SafetyCenterNavigationProp>()
  const country =
    useProfileStore((state) => state.profile?.location.country) ??
    FALLBACK_COUNTRY
  const resource =
    EMERGENCY_NUMBERS[country] ?? EMERGENCY_NUMBERS[FALLBACK_COUNTRY]

  const handleGuidelinesPress = (): void => {
    void Linking.openURL(GUIDELINES_URL)
  }

  const handleReportUser = (): void => {
    navigation.navigate('Matches', { screen: 'MatchesList' })
  }

  const handleContactSupport = (): void => {
    void Linking.openURL(SUPPORT_MAILTO_URL)
  }

  const handlePhonePress = (number: string): void => {
    void Linking.openURL(`tel:${number.replace(/\s/g, '')}`)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionHeader}>{t('safety.sections.tips')}</Text>
      {TIPS.map((tip: Tip): React.JSX.Element => (
        <TipCard key={tip.titleKey} tip={tip} />
      ))}

      <Text style={styles.sectionHeader}>
        {t('safety.sections.guidelines')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>{t('safety.guidelines.body')}</Text>
        <Pressable
          style={styles.linkRow}
          onPress={handleGuidelinesPress}
          accessibilityRole="link"
        >
          <Text style={styles.linkText}>
            {t('safety.guidelines.readFull')}
          </Text>
          <Ionicons
            name="open-outline"
            size={SECTION_ICON_SIZE}
            color={colors.primary}
          />
        </Pressable>
      </View>

      <Text style={styles.sectionHeader}>
        {t('safety.sections.quickActions')}
      </Text>
      <View style={styles.card}>
        <Pressable
          style={styles.actionRow}
          onPress={handleReportUser}
          accessibilityRole="button"
        >
          <Ionicons
            name="flag-outline"
            size={SECTION_ICON_SIZE}
            color={colors.danger}
          />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>
              {t('safety.actions.report.title')}
            </Text>
            <Text style={styles.actionSubtitle}>
              {t('safety.actions.report.subtitle')}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={SECTION_ICON_SIZE}
            color={colors.gray[400]}
          />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.actionRow}
          onPress={handleContactSupport}
          accessibilityRole="button"
        >
          <Ionicons
            name="mail-open-outline"
            size={SECTION_ICON_SIZE}
            color={colors.secondary}
          />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>
              {t('safety.actions.support.title')}
            </Text>
            <Text style={styles.actionSubtitle}>
              {t('safety.actions.support.subtitle')}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={SECTION_ICON_SIZE}
            color={colors.gray[400]}
          />
        </Pressable>
      </View>

      <Text style={styles.sectionHeader}>
        {t('safety.sections.emergency')}
      </Text>
      <View style={styles.card}>
        <Pressable
          style={styles.emergencyRow}
          onPress={(): void => {
            handlePhonePress(resource.police)
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('safety.emergency.police')}: ${
            resource.police
          }`}
        >
          <Ionicons
            name="alert-circle-outline"
            size={SECTION_ICON_SIZE}
            color={colors.danger}
          />
          <View style={styles.emergencyText}>
            <Text style={styles.emergencyLabel}>
              {t('safety.emergency.police')}
            </Text>
            <Text style={styles.emergencyNumber}>{resource.police}</Text>
          </View>
          <Ionicons
            name="call-outline"
            size={SECTION_ICON_SIZE}
            color={colors.primary}
          />
        </Pressable>

        {resource.crisis !== undefined && (
          <>
            <View style={styles.divider} />
            <Pressable
              style={styles.emergencyRow}
              onPress={(): void => {
                if (resource.crisis !== undefined) {
                  handlePhonePress(resource.crisis)
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`${resource.crisisName ?? ''}: ${
                resource.crisis
              }`}
            >
              <Ionicons
                name="heart-circle-outline"
                size={SECTION_ICON_SIZE}
                color={colors.secondary}
              />
              <View style={styles.emergencyText}>
                <Text style={styles.emergencyLabel}>
                  {resource.crisisName}
                </Text>
                <Text style={styles.emergencyNumber}>{resource.crisis}</Text>
              </View>
              <Ionicons
                name="call-outline"
                size={SECTION_ICON_SIZE}
                color={colors.primary}
              />
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionSubtitle: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  actionText: {
    flex: 1,
    gap: spacing.xs,
  },
  actionTitle: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  cardBody: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  divider: {
    backgroundColor: colors.gray[200],
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  emergencyLabel: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  emergencyNumber: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  emergencyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  emergencyText: {
    flex: 1,
    gap: spacing.xs,
  },
  linkRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  sectionHeader: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
    textTransform: 'uppercase',
  },
  tipBody: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    paddingTop: spacing.sm,
  },
  tipCard: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  tipHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  tipTitle: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
})
