import React, { useCallback, useEffect, useState } from 'react'

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { ListRenderItemInfo } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useProfileStore } from '@/store/profileStore'

import { db } from '@/services/firebase/config'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface BlockedEntry {
  blockedId: string
  firstName: string
  photoUrl: string | null
  isDeleted: boolean
}

const AVATAR_SIZE = spacing.xxxl - spacing.xs
const UNBLOCK_BUTTON_MIN_WIDTH = spacing.xxxl + spacing.md

export default function BlockedUsersScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const uid = useProfileStore((state) => state.profile?.uid)
  const [entries, setEntries] = useState<BlockedEntry[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  const loadBlockedUsers = useCallback(
    async (showInitialLoading: boolean): Promise<void> => {
      if (uid === undefined) {
        setEntries([])
        setIsInitialLoading(false)
        setIsRefreshing(false)
        return
      }

      if (showInitialLoading) {
        setIsInitialLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const blockedSnapshot = await getDocs(
          collection(db, 'blocked', uid, 'users')
        )
        const blockedIds = blockedSnapshot.docs.map(
          (blockedDoc): string => blockedDoc.id
        )
        const resolvedEntries = await Promise.allSettled(
          blockedIds.map(async (blockedId): Promise<BlockedEntry> => {
            const userSnapshot = await getDoc(doc(db, 'users', blockedId))

            if (!userSnapshot.exists()) {
              return {
                blockedId,
                firstName: '',
                photoUrl: null,
                isDeleted: true,
              }
            }

            const userData = userSnapshot.data()
            const firstName =
              typeof userData.firstName === 'string' ? userData.firstName : ''
            const photoUrl =
              Array.isArray(userData.photos) &&
              typeof userData.photos[0] === 'string'
                ? userData.photos[0]
                : null

            return {
              blockedId,
              firstName,
              photoUrl,
              isDeleted: false,
            }
          })
        )
        const nextEntries = resolvedEntries
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<BlockedEntry> =>
              result.status === 'fulfilled'
          )
          .map((result): BlockedEntry => result.value)

        setEntries(nextEntries)
      } catch {
        Alert.alert(t('errors.generic'))
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [t, uid]
  )

  useEffect((): void => {
    void loadBlockedUsers(true)
  }, [loadBlockedUsers])

  const handleRefresh = useCallback((): void => {
    void loadBlockedUsers(false)
  }, [loadBlockedUsers])

  const getEntryName = useCallback(
    (entry: BlockedEntry): string => {
      if (entry.isDeleted || entry.firstName.length === 0) {
        return t('settings.blocked.deletedUser')
      }

      return entry.firstName
    },
    [t]
  )

  const handleUnblock = useCallback(
    (entry: BlockedEntry): void => {
      const shouldUseDeletedMessage =
        entry.isDeleted || entry.firstName.length === 0

      Alert.alert(
        t('settings.blocked.confirmUnblock.title'),
        shouldUseDeletedMessage
          ? t('settings.blocked.confirmUnblock.messageDeleted')
          : t('settings.blocked.confirmUnblock.message', {
              name: entry.firstName,
            }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('settings.blocked.unblock'),
            style: 'destructive',
            onPress: async (): Promise<void> => {
              if (uid === undefined) {
                return
              }

              setUnblockingId(entry.blockedId)

              try {
                await deleteDoc(doc(db, 'blocked', uid, 'users', entry.blockedId))
                setEntries((currentEntries): BlockedEntry[] =>
                  currentEntries.filter(
                    (currentEntry): boolean =>
                      currentEntry.blockedId !== entry.blockedId
                  )
                )
              } catch {
                Alert.alert(t('errors.generic'))
              } finally {
                setUnblockingId(null)
              }
            },
          },
        ]
      )
    },
    [t, uid]
  )

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BlockedEntry>): React.JSX.Element => {
      const isUnblocking = unblockingId === item.blockedId
      const displayName = getEntryName(item)
      const avatarInitial =
        item.isDeleted || item.firstName.length === 0 ? '?' : item.firstName[0]

      return (
        <View style={styles.row}>
          <View style={styles.avatar}>
            {item.photoUrl !== null && !item.isDeleted ? (
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.avatarImage}
                accessibilityLabel={displayName}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.unblockButton,
              pressed && styles.unblockButtonPressed,
            ]}
            onPress={(): void => {
              handleUnblock(item)
            }}
            disabled={isUnblocking}
            accessibilityRole="button"
            accessibilityLabel={t('settings.blocked.unblock')}
          >
            {isUnblocking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.unblockText}>
                {t('settings.blocked.unblock')}
              </Text>
            )}
          </Pressable>
        </View>
      )
    },
    [getEntryName, handleUnblock, t, unblockingId]
  )

  const keyExtractor = useCallback(
    (item: BlockedEntry): string => item.blockedId,
    []
  )

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyContainer : styles.listContent
        }
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons
              name="shield-checkmark-outline"
              size={spacing.xxl}
              color={colors.gray[400]}
            />
            <Text style={styles.emptyTitle}>
              {t('settings.blocked.empty.title')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t('settings.blocked.empty.subtitle')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[500],
  },
  name: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[800],
    marginRight: spacing.sm,
  },
  unblockButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: UNBLOCK_BUTTON_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockButtonPressed: {
    opacity: 0.6,
  },
  unblockText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
})
