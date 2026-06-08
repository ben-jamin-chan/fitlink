import React, { useEffect, useMemo, useRef } from 'react'

import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { Insets, TextStyle, ViewStyle } from 'react-native'

import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

import type { MatchFilterState } from '@/hooks/useMatchFilter'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface FilterActivity {
  value: string
  labelKey: string
}

const ALL_ACTIVITIES: FilterActivity[] = [
  { value: 'Gym', labelKey: 'onboarding.step3.activityOptions.gym' },
  { value: 'Running', labelKey: 'onboarding.step3.activityOptions.running' },
  { value: 'Cycling', labelKey: 'onboarding.step3.activityOptions.cycling' },
  {
    value: 'Swimming',
    labelKey: 'onboarding.step3.activityOptions.swimming',
  },
  { value: 'Yoga', labelKey: 'onboarding.step3.activityOptions.yoga' },
  { value: 'Hiking', labelKey: 'onboarding.step3.activityOptions.hiking' },
  { value: 'CrossFit', labelKey: 'onboarding.step3.activityOptions.crossFit' },
  { value: 'Boxing', labelKey: 'onboarding.step3.activityOptions.boxing' },
  { value: 'Dancing', labelKey: 'onboarding.step3.activityOptions.dancing' },
  {
    value: 'Badminton',
    labelKey: 'onboarding.step3.activityOptions.badminton',
  },
  { value: 'Football', labelKey: 'onboarding.step3.activityOptions.football' },
  {
    value: 'Basketball',
    labelKey: 'onboarding.step3.activityOptions.basketball',
  },
  { value: 'Tennis', labelKey: 'onboarding.step3.activityOptions.tennis' },
  {
    value: 'Martial Arts',
    labelKey: 'onboarding.step3.activityOptions.martialArts',
  },
  {
    value: 'Rock Climbing',
    labelKey: 'onboarding.step3.activityOptions.rockClimbing',
  },
  { value: 'Pilates', labelKey: 'onboarding.step3.activityOptions.pilates' },
]

const RESET_HIT_SLOP: Insets = {
  bottom: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
  top: spacing.sm,
}

const SHEET_HIDDEN_OFFSET = spacing.xxxl * 5
const SHEET_VISIBLE_OFFSET = 0
const SWITCH_TRACK_COLOR = {
  false: colors.gray[300],
  true: colors.primary,
}

interface MatchFilterSheetProps {
  visible: boolean
  filter: MatchFilterState
  onToggleActivity: (activity: string) => void
  onSetRecentlyActiveOnly: (value: boolean) => void
  onReset: () => void
  onClose: () => void
}

export const MatchFilterSheet = ({
  visible,
  filter,
  onToggleActivity,
  onSetRecentlyActiveOnly,
  onReset,
  onClose,
}: MatchFilterSheetProps): React.JSX.Element => {
  const { t } = useTranslation()
  const slideAnimation = useRef(
    new Animated.Value(SHEET_HIDDEN_OFFSET)
  ).current

  useEffect((): void => {
    if (visible) {
      Animated.spring(slideAnimation, {
        toValue: SHEET_VISIBLE_OFFSET,
        damping: spacing.md,
        stiffness: spacing.xxxl * 2 + spacing.lg,
        useNativeDriver: true,
      }).start()
      return
    }

    slideAnimation.setValue(SHEET_HIDDEN_OFFSET)
  }, [slideAnimation, visible])

  const animatedSheetStyle = useMemo(
    () => ({
      transform: [{ translateY: slideAnimation }],
    }),
    [slideAnimation]
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View style={[styles.sheet, animatedSheetStyle]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('matches.filter.title')}</Text>
          <TouchableOpacity
            onPress={onReset}
            hitSlop={RESET_HIT_SLOP}
            activeOpacity={0.75}
          >
            <Text style={styles.resetLabel}>{t('matches.filter.reset')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.toggleLabel}>
                {t('matches.filter.recentlyActive.label')}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {t('matches.filter.recentlyActive.subtitle')}
              </Text>
            </View>
            <Switch
              value={filter.recentlyActiveOnly}
              onValueChange={onSetRecentlyActiveOnly}
              trackColor={SWITCH_TRACK_COLOR}
              thumbColor={colors.white}
              ios_backgroundColor={colors.gray[300]}
            />
          </View>

          <Text style={styles.sectionLabel}>
            {t('matches.filter.activities.label')}
          </Text>
          <View style={styles.chipWrap}>
            {ALL_ACTIVITIES.map((activity) => {
              const isSelected = filter.activities.includes(activity.value)

              return (
                <TouchableOpacity
                  key={activity.value}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => onToggleActivity(activity.value)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected && styles.chipLabelSelected,
                    ]}
                  >
                    {t(activity.labelKey)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            variant="primary"
            label={t('matches.filter.done')}
            onPress={onClose}
          />
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  } as ViewStyle,
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[400],
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  chipLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.sm,
  } as TextStyle,
  chipLabelSelected: {
    color: colors.white,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  } as ViewStyle,
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  } as ViewStyle,
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  } as ViewStyle,
  header: {
    alignItems: 'center',
    borderBottomColor: colors.gray[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
  resetLabel: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  scroll: {
    flexGrow: 0,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  } as ViewStyle,
  sectionLabel: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  } as TextStyle,
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    bottom: 0,
    left: 0,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
    position: 'absolute',
    right: 0,
  } as ViewStyle,
  title: {
    color: colors.gray[800],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  } as TextStyle,
  toggleLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  toggleSubtitle: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  } as TextStyle,
  toggleTextGroup: {
    flex: 1,
    marginRight: spacing.md,
  } as ViewStyle,
})
