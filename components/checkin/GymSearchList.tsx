import React from 'react'

import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ListRenderItem, TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import type { GymPlace } from '@/types/checkin'

import { colors, spacing, typography } from '@/constants/theme'

interface GymSearchListProps {
  gyms: GymPlace[]
  onSelect: (gym: GymPlace) => void
  isLoading: boolean
}

interface GymSearchListStyles {
  centered: ViewStyle
  emptyText: TextStyle
  listContent: ViewStyle
  ratingIcon: TextStyle
  ratingRow: ViewStyle
  row: ViewStyle
  rowContent: ViewStyle
  rowIcon: TextStyle
  separator: ViewStyle
  gymAddress: TextStyle
  gymName: TextStyle
  gymRating: TextStyle
}

const RATING_ICON_SIZE = 14
const ROW_ICON_SIZE = 22
const CHEVRON_ICON_SIZE = 18

const GymSeparator = (): React.JSX.Element => (
  <View style={styles.separator} />
)

export const GymSearchList = ({
  gyms,
  onSelect,
  isLoading,
}: GymSearchListProps): React.JSX.Element => {
  const { t } = useTranslation()

  const renderGym: ListRenderItem<GymPlace> = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onSelect(item)}
      activeOpacity={0.8}
      accessibilityLabel={item.name}
    >
      <Ionicons
        name="fitness-outline"
        size={ROW_ICON_SIZE}
        color={colors.primary}
        style={styles.rowIcon}
      />
      <View style={styles.rowContent}>
        <Text style={styles.gymName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.gymAddress} numberOfLines={1}>
          {item.address}
        </Text>
        {item.rating !== undefined && (
          <View style={styles.ratingRow}>
            <Ionicons
              name="star"
              size={RATING_ICON_SIZE}
              color={colors.warning}
              style={styles.ratingIcon}
            />
            <Text style={styles.gymRating}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Ionicons
        name="chevron-forward-outline"
        size={CHEVRON_ICON_SIZE}
        color={colors.gray[400]}
      />
    </TouchableOpacity>
  )

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (gyms.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('checkin.noGymsNearby')}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={gyms}
      keyExtractor={(item: GymPlace): string => item.placeId}
      renderItem={renderGym}
      ItemSeparatorComponent={GymSeparator}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  )
}

const styles = StyleSheet.create<GymSearchListStyles>({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  gymAddress: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs / 2,
  },
  gymName: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  gymRating: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
  },
  listContent: {
    flexGrow: 1,
  },
  ratingIcon: {
    marginRight: spacing.xs / 2,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.xs / 2,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowContent: {
    flex: 1,
  },
  rowIcon: {
    marginRight: spacing.sm,
  },
  separator: {
    backgroundColor: colors.gray[200],
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + ROW_ICON_SIZE + spacing.sm,
  },
})
