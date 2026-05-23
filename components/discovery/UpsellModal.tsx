import React from 'react'

import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { showToast } from '@/store/toastStore'

import { Button } from '@/components/ui/Button'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const HERO_ICON_SIZE = spacing.xxl - spacing.sm
const BENEFIT_ICON_SIZE = spacing.lg - spacing.xs

interface UpsellModalProps {
  visible: boolean
  onDismiss: () => void
  reason: 'likes' | 'superLike'
}

const BENEFITS: Array<{ icon: keyof typeof Ionicons.glyphMap; key: string }> = [
  { icon: 'heart-outline', key: 'unlimitedLikes' },
  { icon: 'star-outline', key: 'superLikes' },
  { icon: 'eye-outline', key: 'seeWhoLiked' },
  { icon: 'arrow-undo-outline', key: 'rewind' },
  { icon: 'flash-outline', key: 'priority' },
]

export const UpsellModal = ({
  visible,
  onDismiss,
  reason,
}: UpsellModalProps): React.JSX.Element => {
  const { t } = useTranslation()

  const handleUpgrade = (): void => {
    // TODO: Phase 2 will navigate to PremiumScreen.
    showToast(t('discovery.limit.comingSoon'), 'info')
    onDismiss()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons
              name="flash"
              size={HERO_ICON_SIZE}
              color={colors.warning}
            />
            <Text style={styles.headline}>
              {reason === 'likes'
                ? t('discovery.limit.outOfLikes')
                : t('discovery.limit.premiumFeature')}
            </Text>
            <Text style={styles.subheadline}>
              {t('discovery.limit.upgradeSubtitle')}
            </Text>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.key} style={styles.benefitRow}>
                <Ionicons
                  name={benefit.icon}
                  size={BENEFIT_ICON_SIZE}
                  color={colors.primary}
                  style={styles.benefitIcon}
                />
                <Text style={styles.benefitText}>
                  {t(`discovery.limit.benefits.${benefit.key}`)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label={t('discovery.limit.upgradeCta')}
              onPress={handleUpgrade}
              variant="primary"
            />
            <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>
                {t('discovery.limit.maybeLater')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  benefitIcon: {
    marginRight: spacing.md,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  benefitText: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
  },
  benefits: {
    marginBottom: spacing.xl,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dismissText: {
    color: colors.gray[500],
    fontSize: typography.sizes.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headline: {
    color: colors.gray[800],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  subheadline: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})
