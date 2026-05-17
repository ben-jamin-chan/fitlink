import React from 'react'

import { Modal, StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const HERO_ICON_SIZE = 48
const BENEFIT_ICON_SIZE = 20
const HANDLE_WIDTH = 42
const HANDLE_HEIGHT = 5

export type UpsellTrigger = 'super_like' | 'rewind' | 'daily_limit'

interface UpsellModalProps {
  visible: boolean
  trigger: UpsellTrigger
  onDismiss: () => void
  onUpgrade: () => void
}

export const UpsellModal = ({
  visible,
  trigger,
  onDismiss,
  onUpgrade,
}: UpsellModalProps): React.JSX.Element => {
  const { t } = useTranslation()

  const getHeadline = (): string => {
    if (trigger === 'daily_limit') {
      return t('discovery.upsell.outOfLikes')
    }

    if (trigger === 'rewind') {
      return t('discovery.upsell.rewind')
    }

    return t('discovery.upsell.superLike')
  }

  const benefits = [
    t('discovery.upsell.benefit1'),
    t('discovery.upsell.benefit2'),
    t('discovery.upsell.benefit3'),
    t('discovery.upsell.benefit4'),
  ]

  const heroIcon = trigger === 'daily_limit' ? 'heart' : 'star'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        <View style={styles.handle} />
        <View style={styles.heroIcon}>
          <Ionicons
            name={heroIcon}
            size={HERO_ICON_SIZE}
            color={trigger === 'daily_limit' ? colors.primary : colors.secondary}
          />
        </View>
        <Text style={styles.title}>{getHeadline()}</Text>

        <View style={styles.benefits}>
          {benefits.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <Ionicons
                name="checkmark-circle"
                size={BENEFIT_ICON_SIZE}
                color={colors.primary}
              />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={t('discovery.upsell.upgradeCta')}
            onPress={onUpgrade}
            variant="primary"
            fullWidth
          />
          <Button
            label={t('discovery.upsell.maybeLater')}
            onPress={onDismiss}
            variant="ghost"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    width: '100%',
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  benefitText: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  benefits: {
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    backgroundColor: colors.gray[300],
    borderRadius: borderRadius.full,
    height: HANDLE_HEIGHT,
    marginBottom: spacing.xl,
    width: HANDLE_WIDTH,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    elevation: 2,
    height: spacing.xxxl,
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      height: spacing.xs,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: spacing.sm,
    width: spacing.xxxl,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
})
