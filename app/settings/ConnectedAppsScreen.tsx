import React, { useCallback, useState } from 'react'

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { Timestamp } from 'firebase/firestore'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { useFitnessStore } from '@/store/fitnessStore'

import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'

import { useAppleHealth } from '@/hooks/useAppleHealth'
import { useGoogleFit } from '@/hooks/useGoogleFit'

import {
  connectStrava,
  disconnectStrava,
  syncStrava,
} from '@/services/strava'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const MINUTE_IN_MS = 60_000
const MINUTES_IN_HOUR = 60
const HOURS_IN_DAY = 24

const getTimestampMillis = (
  timestamp: Timestamp | null | undefined
): number | null => {
  if (timestamp === null || timestamp === undefined) {
    return null
  }

  if (typeof timestamp.toMillis !== 'function') {
    return null
  }

  return timestamp.toMillis()
}

const formatLastSynced = (
  timestamp: Timestamp | null | undefined,
  t: TFunction
): string => {
  const timestampMillis = getTimestampMillis(timestamp)

  if (timestampMillis === null) {
    return t('fitness.connectedApps.neverSynced')
  }

  const diffMin = Math.floor((Date.now() - timestampMillis) / MINUTE_IN_MS)

  if (diffMin < 1) {
    return t('fitness.connectedApps.justNow')
  }

  if (diffMin < MINUTES_IN_HOUR) {
    return t('fitness.connectedApps.minutesAgo', { count: diffMin })
  }

  const diffHr = Math.floor(diffMin / MINUTES_IN_HOUR)

  if (diffHr < HOURS_IN_DAY) {
    return t('fitness.connectedApps.hoursAgo', { count: diffHr })
  }

  return t('fitness.connectedApps.daysAgo', {
    count: Math.floor(diffHr / HOURS_IN_DAY),
  })
}

interface SyncButtonProps {
  onPress: () => void
  isSyncing: boolean
  label: string
  disabled?: boolean
}

const SyncButton = ({
  onPress,
  isSyncing,
  label,
  disabled = false,
}: SyncButtonProps): React.JSX.Element => {
  const isDisabled = isSyncing || disabled

  return (
    <TouchableOpacity
      style={[styles.syncButton, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.syncButtonText}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

export default function ConnectedAppsScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.uid)
  const shareOnProfile = useFitnessStore((state) => state.shareOnProfile)
  const appleHealthConnection = useFitnessStore(
    (state) => state.connections.appleHealth
  )
  const googleFitConnection = useFitnessStore(
    (state) => state.connections.googleFit
  )
  const stravaConnection = useFitnessStore((state) => state.connections.strava)
  const setShareOnProfile = useFitnessStore(
    (state) => state.setShareOnProfile
  )
  const connectSource = useFitnessStore((state) => state.connectSource)
  const disconnectSource = useFitnessStore((state) => state.disconnectSource)
  const fetchTodayStats = useFitnessStore((state) => state.fetchTodayStats)

  const {
    isConnected: isAppleHealthConnected,
    sync: syncAppleHealth,
    disconnect: disconnectAppleHealth,
  } = useAppleHealth()
  const {
    isConnected: isGoogleFitConnected,
    sync: syncGoogleFit,
    disconnect: disconnectGoogleFit,
  } = useGoogleFit()

  const [isSyncingApple, setIsSyncingApple] = useState<boolean>(false)
  const [isSyncingGoogleFit, setIsSyncingGoogleFit] =
    useState<boolean>(false)
  const [isSyncingStrava, setIsSyncingStrava] = useState<boolean>(false)
  const [isConnectingStrava, setIsConnectingStrava] =
    useState<boolean>(false)

  const isUserAvailable = userId !== undefined

  const handleAppleHealthToggle = useCallback(
    async (enabled: boolean): Promise<void> => {
      try {
        if (enabled) {
          if (userId === undefined) {
            return
          }

          await connectSource(userId, 'appleHealth')
          await syncAppleHealth()
          return
        }

        await disconnectAppleHealth()
      } catch {
        Alert.alert(
          t('fitness.source.appleHealth'),
          t('fitness.appleHealth.syncError')
        )
      }
    },
    [connectSource, disconnectAppleHealth, syncAppleHealth, t, userId]
  )

  const handleAppleHealthSync = useCallback(async (): Promise<void> => {
    if (isSyncingApple) {
      return
    }

    setIsSyncingApple(true)

    try {
      await syncAppleHealth()
    } catch {
      Alert.alert(
        t('fitness.source.appleHealth'),
        t('fitness.appleHealth.syncError')
      )
    } finally {
      setIsSyncingApple(false)
    }
  }, [isSyncingApple, syncAppleHealth, t])

  const handleGoogleFitToggle = useCallback(
    async (enabled: boolean): Promise<void> => {
      try {
        if (enabled) {
          if (userId === undefined) {
            return
          }

          await connectSource(userId, 'googleFit')
          await syncGoogleFit(userId)
          return
        }

        await disconnectGoogleFit(userId)
      } catch {
        Alert.alert(t('fitness.source.googleFit'), t('fitness.errors.syncFailed'))
      }
    },
    [connectSource, disconnectGoogleFit, syncGoogleFit, t, userId]
  )

  const handleGoogleFitSync = useCallback(async (): Promise<void> => {
    if (isSyncingGoogleFit) {
      return
    }

    setIsSyncingGoogleFit(true)

    try {
      await syncGoogleFit(userId)
    } catch {
      Alert.alert(t('fitness.source.googleFit'), t('fitness.errors.syncFailed'))
    } finally {
      setIsSyncingGoogleFit(false)
    }
  }, [isSyncingGoogleFit, syncGoogleFit, t, userId])

  const handleStravaConnect = useCallback(async (): Promise<void> => {
    if (isConnectingStrava || userId === undefined) {
      return
    }

    setIsConnectingStrava(true)

    try {
      await connectStrava(userId)
    } catch {
      Alert.alert(
        t('fitness.strava.connectErrorTitle'),
        t('fitness.strava.connectErrorMessage')
      )
    } finally {
      setIsConnectingStrava(false)
    }
  }, [isConnectingStrava, t, userId])

  const handleStravaDisconnect = useCallback((): void => {
    Alert.alert(
      t('fitness.strava.disconnectTitle'),
      t('fitness.strava.disconnectMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('fitness.strava.disconnectConfirm'),
          style: 'destructive',
          onPress: (): void => {
            if (userId === undefined) {
              return
            }

            void (async (): Promise<void> => {
              try {
                await disconnectStrava(userId)
                await disconnectSource(userId, 'strava')
              } catch {
                Alert.alert(
                  t('fitness.strava.disconnectErrorTitle'),
                  t('fitness.strava.disconnectErrorMessage')
                )
              }
            })()
          },
        },
      ]
    )
  }, [disconnectSource, t, userId])

  const handleStravaSync = useCallback(async (): Promise<void> => {
    if (isSyncingStrava) {
      return
    }

    setIsSyncingStrava(true)

    try {
      await syncStrava()

      if (userId !== undefined) {
        await fetchTodayStats(userId)
      }
    } catch {
      Alert.alert(
        t('fitness.connectedApps.syncErrorTitle'),
        t('fitness.connectedApps.syncErrorMessage')
      )
    } finally {
      setIsSyncingStrava(false)
    }
  }, [fetchTodayStats, isSyncingStrava, t, userId])

  const handleShareToggle = useCallback(
    (enabled: boolean): void => {
      if (userId === undefined) {
        return
      }

      void setShareOnProfile(userId, enabled)
    },
    [setShareOnProfile, userId]
  )

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {Platform.OS === 'ios' && (
        <SettingsSection title={t('fitness.source.appleHealth')}>
          <SettingsRow
            label={t('fitness.source.appleHealth')}
            variant="toggle"
            isEnabled={isAppleHealthConnected}
            onToggle={(enabled: boolean): void => {
              void handleAppleHealthToggle(enabled)
            }}
            icon="fitness-outline"
            disabled={!isUserAvailable}
            isLast={!isAppleHealthConnected}
          />
          {isAppleHealthConnected ? (
            <View style={styles.sourceStatusRow}>
              <Text style={styles.lastSyncedText}>
                {formatLastSynced(appleHealthConnection?.lastSync, t)}
              </Text>
              <SyncButton
                onPress={(): void => {
                  void handleAppleHealthSync()
                }}
                isSyncing={isSyncingApple}
                label={t('fitness.connectedApps.syncNow')}
                disabled={!isUserAvailable}
              />
            </View>
          ) : (
            <View style={styles.helperRow}>
              <Text style={styles.helperText}>
                {t('fitness.connectedApps.notConnected')}
              </Text>
            </View>
          )}
        </SettingsSection>
      )}

      {Platform.OS === 'android' && (
        <SettingsSection title={t('fitness.source.googleFit')}>
          <SettingsRow
            label={t('fitness.source.googleFit')}
            variant="toggle"
            isEnabled={isGoogleFitConnected}
            onToggle={(enabled: boolean): void => {
              void handleGoogleFitToggle(enabled)
            }}
            icon="fitness-outline"
            disabled={!isUserAvailable}
            isLast={!isGoogleFitConnected}
          />
          {isGoogleFitConnected ? (
            <View style={styles.sourceStatusRow}>
              <Text style={styles.lastSyncedText}>
                {formatLastSynced(googleFitConnection?.lastSync, t)}
              </Text>
              <SyncButton
                onPress={(): void => {
                  void handleGoogleFitSync()
                }}
                isSyncing={isSyncingGoogleFit}
                label={t('fitness.connectedApps.syncNow')}
                disabled={!isUserAvailable}
              />
            </View>
          ) : (
            <View style={styles.helperRow}>
              <Text style={styles.helperText}>
                {t('fitness.connectedApps.notConnected')}
              </Text>
            </View>
          )}
        </SettingsSection>
      )}

      <SettingsSection title={t('fitness.source.strava')}>
        {stravaConnection.connected ? (
          <>
            <View style={styles.stravaConnectedRow}>
              <Ionicons
                name="checkmark-circle"
                size={spacing.lg}
                color={colors.primary}
              />
              <View style={styles.stravaStatusColumn}>
                <Text style={styles.stravaConnectedLabel}>
                  {t('fitness.strava.connected')}
                </Text>
                <Text style={styles.lastSyncedText}>
                  {formatLastSynced(stravaConnection?.lastSync, t)}
                </Text>
              </View>
            </View>
            <View style={styles.stravaActionRow}>
              <SyncButton
                onPress={(): void => {
                  void handleStravaSync()
                }}
                isSyncing={isSyncingStrava}
                label={t('fitness.connectedApps.syncNow')}
                disabled={!isUserAvailable}
              />
              <TouchableOpacity
                style={[
                  styles.disconnectButton,
                  !isUserAvailable && styles.buttonDisabled,
                ]}
                onPress={handleStravaDisconnect}
                disabled={!isUserAvailable}
                activeOpacity={0.75}
              >
                <Text style={styles.disconnectButtonText}>
                  {t('fitness.strava.disconnect')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.connectRow}>
            <View style={styles.connectInfo}>
              <Text style={styles.connectLabel}>
                {t('fitness.source.strava')}
              </Text>
              <Text style={styles.helperText}>
                {t('fitness.connectedApps.notConnected')}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.connectButton,
                (isConnectingStrava || !isUserAvailable) &&
                  styles.buttonDisabled,
              ]}
              onPress={(): void => {
                void handleStravaConnect()
              }}
              disabled={isConnectingStrava || !isUserAvailable}
              activeOpacity={0.75}
            >
              {isConnectingStrava ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.connectButtonText}>
                  {t('fitness.strava.connect')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.connectedApps.shareSection')}>
        <SettingsRow
          label={t('settings.connectedApps.shareLabel')}
          variant="toggle"
          isEnabled={shareOnProfile}
          onToggle={handleShareToggle}
          icon="share-outline"
          disabled={!isUserAvailable}
          isLast={true}
        />
        <View style={styles.shareHelperRow}>
          <Text style={styles.helperText}>
            {t('settings.connectedApps.shareHelper')}
          </Text>
        </View>
      </SettingsSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  helperRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  } as ViewStyle,
  helperText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
  } as TextStyle,
  lastSyncedText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
  } as TextStyle,
  sourceStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  syncButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: spacing.xl,
    minWidth: spacing.xxxl + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  syncButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  stravaConnectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  } as ViewStyle,
  stravaStatusColumn: {
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  stravaConnectedLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  stravaActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  } as ViewStyle,
  disconnectButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: spacing.xl,
    minWidth: spacing.xxxl + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  disconnectButtonText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  connectRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
  connectInfo: {
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  connectLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  connectButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    minHeight: spacing.xl,
    minWidth: spacing.xxxl + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  connectButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  buttonDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  shareHelperRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  } as ViewStyle,
})
