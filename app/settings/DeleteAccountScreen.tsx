import React, { useState } from 'react'

import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'

import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import type { SettingsStackParamList } from '@/app/navigation/MainTabNavigator'
import { deleteAccount } from '@/services/firebase/auth'
import { mapFirebaseError } from '@/utils/errorUtils'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type DeleteAccountNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  'DeleteAccount'
>

const CONFIRMATION_TEXT = 'DELETE'

const showDeleteToast = (message: string): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG)
    return
  }

  Alert.alert(message)
}

export default function DeleteAccountScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<DeleteAccountNavigationProp>()
  const logout = useAuthStore((state) => state.logout)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = confirmation === CONFIRMATION_TEXT

  const handleBack = (): void => {
    navigation.goBack()
  }

  const handleDelete = async (): Promise<void> => {
    if (!canDelete) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteAccount()
      await logout()
    } catch (error: unknown) {
      setIsDeleting(false)
      showDeleteToast(t(mapFirebaseError(error)))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay visible={isDeleting} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.75}
          accessibilityLabel={t('common.back')}
        >
          <Ionicons
            name="chevron-back"
            size={spacing.xl}
            color={colors.gray[900]}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningIcon}>
          <Ionicons
            name="warning-outline"
            size={spacing.xxxl}
            color={colors.danger}
          />
        </View>

        <Text style={styles.title}>
          {t('settings.danger.deleteScreen.title')}
        </Text>
        <Text style={styles.subtitle}>
          {t('settings.danger.deleteScreen.whatDeleted')}
        </Text>

        <View style={styles.bulletList}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              {t('settings.danger.deleteScreen.item1')}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              {t('settings.danger.deleteScreen.item2')}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              {t('settings.danger.deleteScreen.item3')}
            </Text>
          </View>
        </View>

        <Text style={styles.helperText}>
          {t('settings.danger.deleteScreen.typeToConfirm')}
        </Text>
        <TextInput
          style={styles.input}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={t('settings.danger.deleteScreen.placeholder')}
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isDeleting}
        />

        <TouchableOpacity
          style={[
            styles.deleteButton,
            (!canDelete || isDeleting) && styles.deleteButtonDisabled,
          ]}
          onPress={(): void => {
            void handleDelete()
          }}
          disabled={!canDelete || isDeleting}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteButtonText}>
            {t('settings.danger.deleteScreen.confirmButton')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    alignItems: 'center',
    height: spacing.xl,
    justifyContent: 'center',
    width: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.md,
  },
  bulletList: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    height: spacing.sm,
    marginTop: spacing.sm,
    width: spacing.sm,
  },
  bulletText: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
  },
  helperText: {
    color: colors.gray[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    height: 52,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
})
