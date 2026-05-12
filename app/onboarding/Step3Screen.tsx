import React, { useState } from 'react'

import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useOnboardingStore } from '@/store/onboardingStore'

import { Button } from '@/components/ui/Button'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { SingleSelect } from '@/components/ui/SingleSelect'

import {
  OnboardingHeader,
  type OnboardingStackParamList,
} from '@/app/onboarding/OnboardingNavigator'
import type { FitnessLevel } from '@/types/user'

import { colors, spacing, typography } from '@/constants/theme'

type Step3NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step3'>

const STEP = 3

export default function Step3Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step3NavigationProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const activitiesOptions = [
    t('onboarding.step3.activityOptions.gym'),
    t('onboarding.step3.activityOptions.running'),
    t('onboarding.step3.activityOptions.cycling'),
    t('onboarding.step3.activityOptions.swimming'),
    t('onboarding.step3.activityOptions.yoga'),
    t('onboarding.step3.activityOptions.hiking'),
    t('onboarding.step3.activityOptions.crossFit'),
    t('onboarding.step3.activityOptions.boxing'),
    t('onboarding.step3.activityOptions.dancing'),
    t('onboarding.step3.activityOptions.badminton'),
    t('onboarding.step3.activityOptions.football'),
    t('onboarding.step3.activityOptions.basketball'),
    t('onboarding.step3.activityOptions.tennis'),
    t('onboarding.step3.activityOptions.martialArts'),
    t('onboarding.step3.activityOptions.rockClimbing'),
    t('onboarding.step3.activityOptions.pilates'),
  ]
  const fitnessLevelOptions = [
    t('onboarding.step3.fitnessLevelOptions.beginner'),
    t('onboarding.step3.fitnessLevelOptions.intermediate'),
    t('onboarding.step3.fitnessLevelOptions.advanced'),
    t('onboarding.step3.fitnessLevelOptions.athlete'),
  ]
  const frequencyOptions = [
    t('onboarding.step3.frequencyOptions.oneToTwo'),
    t('onboarding.step3.frequencyOptions.threeToFour'),
    t('onboarding.step3.frequencyOptions.fiveToSix'),
    t('onboarding.step3.frequencyOptions.daily'),
  ]
  const fitnessLevelMap: Record<string, FitnessLevel> = {
    [t('onboarding.step3.fitnessLevelOptions.beginner')]: 'beginner',
    [t('onboarding.step3.fitnessLevelOptions.intermediate')]: 'intermediate',
    [t('onboarding.step3.fitnessLevelOptions.advanced')]: 'advanced',
    [t('onboarding.step3.fitnessLevelOptions.athlete')]: 'athlete',
  }
  const fitnessLevelDisplayMap: Record<FitnessLevel, string> = {
    beginner: t('onboarding.step3.fitnessLevelOptions.beginner'),
    intermediate: t('onboarding.step3.fitnessLevelOptions.intermediate'),
    advanced: t('onboarding.step3.fitnessLevelOptions.advanced'),
    athlete: t('onboarding.step3.fitnessLevelOptions.athlete'),
  }

  const [activities, setActivities] = useState<string[]>(
    draft.activities ?? []
  )
  const [selectedFitnessLevel, setSelectedFitnessLevel] = useState<
    string | null
  >(
    draft.fitnessLevel !== undefined
      ? fitnessLevelDisplayMap[draft.fitnessLevel]
      : null
  )
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(
    draft.workoutFrequency ?? null
  )

  const isValid =
    activities.length >= 1 &&
    selectedFitnessLevel !== null &&
    selectedFrequency !== null

  const handleNext = (): void => {
    if (selectedFitnessLevel === null || selectedFrequency === null) {
      return
    }

    updateDraft({
      activities,
      fitnessLevel: fitnessLevelMap[selectedFitnessLevel],
      workoutFrequency: selectedFrequency,
    })
    setCurrentStep(4)
    navigation.navigate('Step4')
  }

  return (
    <View style={styles.container}>
      <OnboardingHeader step={STEP} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>
          {t('onboarding.step3.activitiesLabel')}
        </Text>
        <MultiSelect
          options={activitiesOptions}
          selected={activities}
          onChange={setActivities}
          min={1}
          max={10}
        />

        <Text style={styles.sectionLabel}>
          {t('onboarding.step3.fitnessLevelLabel')}
        </Text>
        <SingleSelect
          options={fitnessLevelOptions}
          selected={selectedFitnessLevel}
          onChange={setSelectedFitnessLevel}
        />

        <Text style={styles.sectionLabel}>
          {t('onboarding.step3.frequencyLabel')}
        </Text>
        <SingleSelect
          options={frequencyOptions}
          selected={selectedFrequency}
          onChange={setSelectedFrequency}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <View style={styles.buttonContainer}>
        <Button
          label={t('common.next')}
          onPress={handleNext}
          disabled={!isValid}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
  buttonContainer: {
    backgroundColor: colors.background,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
})
