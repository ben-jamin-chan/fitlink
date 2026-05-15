import React, { useEffect, useState } from 'react'

import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ListRenderItemInfo } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useOnboardingStore } from '@/store/onboardingStore'

import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Slider } from '@/components/ui/Slider'

import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'

import {
  borderRadius,
  colors,
  MAX_BIO_LENGTH,
  MIN_BIO_LENGTH,
  spacing,
  typography,
} from '@/constants/theme'

type Step5NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step5'>

const STEP = 5
const HEIGHT_MIN = 140
const HEIGHT_MAX = 220
const HEIGHT_DEFAULT = 170
const COUNTER_DANGER_THRESHOLD = 20

const RELIGION_OPTION_KEYS = [
  'islam',
  'buddhism',
  'christianity',
  'hinduism',
  'sikhism',
  'noPreference',
  'preferNotToSay',
] as const

export default function Step5Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step5NavigationProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const [bio, setBio] = useState<string>(draft.bio ?? '')
  const [height, setHeight] = useState<number>(draft.height ?? HEIGHT_DEFAULT)
  const [religion, setReligion] = useState<string | undefined>(draft.religion)
  const [isReligionModalOpen, setIsReligionModalOpen] =
    useState<boolean>(false)

  const religionOptions = RELIGION_OPTION_KEYS.map(
    (optionKey): string =>
      t(`onboarding.step5.religion.options.${optionKey}`)
  )

  const charCount = bio.length
  const charsRemaining = MAX_BIO_LENGTH - charCount
  const isValid = charCount >= MIN_BIO_LENGTH

  useEffect((): void => {
    setCurrentStep(STEP)
  }, [setCurrentStep])

  const saveDraft = (): void => {
    updateDraft({ bio, height, religion })
  }

  const handleBack = (): void => {
    saveDraft()
    setCurrentStep(4)
    navigation.navigate('Step4')
  }

  const handleNext = (): void => {
    saveDraft()
    setCurrentStep(6)
    navigation.navigate('Step6')
  }

  const handleSelectReligion = (option: string): void => {
    setReligion(option)
    setIsReligionModalOpen(false)
  }

  const handleClearReligion = (): void => {
    setReligion(undefined)
    setIsReligionModalOpen(false)
  }

  const renderReligionOption = ({
    item,
  }: ListRenderItemInfo<string>): React.JSX.Element => {
    const isSelected = religion === item

    return (
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => handleSelectReligion(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.modalOptionText}>{item}</Text>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step5.title')}</Text>

          <Text style={styles.fieldLabel}>
            {t('onboarding.step5.bio.label')}
          </Text>
          <Input
            placeholder={t('onboarding.step5.bio.placeholder')}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
            maxLength={MAX_BIO_LENGTH}
          />
          <View style={styles.counterRow}>
            {charCount > 0 && charCount < MIN_BIO_LENGTH ? (
              <Text style={styles.bioError}>
                {t('onboarding.step5.bio.errorMin')}
              </Text>
            ) : (
              <View />
            )}
            <Text
              style={[
                styles.counter,
                charsRemaining <= COUNTER_DANGER_THRESHOLD &&
                  styles.counterDanger,
              ]}
            >
              {t('onboarding.step5.bio.counter', {
                count: charCount,
                max: MAX_BIO_LENGTH,
              })}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            {t('onboarding.step5.height.label')}
          </Text>
          <Slider
            label={t('onboarding.step5.height.label')}
            value={height}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={1}
            onChange={setHeight}
            formatLabel={(value: number): string =>
              t('onboarding.step5.height.value', { value })
            }
          />

          <Text style={styles.fieldLabel}>
            {t('onboarding.step5.religion.label')}
          </Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setIsReligionModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pickerText,
                religion === undefined && styles.pickerPlaceholder,
              ]}
            >
              {religion ?? t('onboarding.step5.religion.placeholder')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.gray[400]} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <View style={styles.backButton}>
          <Button
            label={t('common.back')}
            onPress={handleBack}
            variant="outline"
          />
        </View>
        <View style={styles.nextButton}>
          <Button
            label={t('common.next')}
            onPress={handleNext}
            disabled={!isValid}
          />
        </View>
      </View>

      <Modal
        visible={isReligionModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReligionModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('onboarding.step5.religion.modalTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => setIsReligionModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            {religion !== undefined && (
              <TouchableOpacity
                style={styles.clearRow}
                onPress={handleClearReligion}
                activeOpacity={0.7}
              >
                <Text style={styles.clearText}>
                  {t('onboarding.step5.religion.clearSelection')}
                </Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={religionOptions}
              keyExtractor={(item: string): string => item}
              renderItem={renderReligionOption}
              ItemSeparatorComponent={ReligionOptionSeparator}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const ReligionOptionSeparator = (): React.JSX.Element => (
  <View style={styles.separator} />
)

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  counter: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
  },
  counterDanger: {
    color: colors.danger,
  },
  bioError: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs / 2,
    backgroundColor: colors.surface,
  },
  pickerText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  },
  pickerPlaceholder: {
    color: colors.gray[400],
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
  },
  clearRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  clearText: {
    fontSize: typography.sizes.md,
    color: colors.danger,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalOptionText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  },
  separator: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginHorizontal: spacing.lg,
  },
})
