import React from 'react'

import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { pickAndCompressImage } from '@/utils/imageUtils'

import {
  borderRadius,
  colors,
  MAX_PHOTOS,
  spacing,
  typography,
} from '@/constants/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = spacing.lg * 2
const GRID_GAP = spacing.sm
const SLOT_SIZE = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP * 2) / 3

interface PhotoGridProps {
  photoUris: string[]
  onPhotosChange?: (uris: string[]) => void
  maxPhotos?: number
  readOnly?: boolean
}

export const PhotoGrid = ({
  photoUris,
  onPhotosChange,
  maxPhotos = MAX_PHOTOS,
  readOnly = false,
}: PhotoGridProps): React.JSX.Element => {
  const { t } = useTranslation()

  const handleAddPhoto = async (slotIndex: number): Promise<void> => {
    if (onPhotosChange === undefined) {
      return
    }

    const uri = await pickAndCompressImage()

    if (uri === null) {
      Alert.alert(t('errors.photo.permission'), '', [
        { text: t('common.ok', { defaultValue: t('common.done') }) },
      ])
      return
    }

    const newUris = [...photoUris]
    newUris[slotIndex] = uri
    onPhotosChange(newUris.filter(Boolean))
  }

  const handleRemovePhoto = (index: number): void => {
    if (onPhotosChange === undefined) {
      return
    }

    onPhotosChange(photoUris.filter((_, photoIndex) => photoIndex !== index))
  }

  const slots = readOnly
    ? photoUris.map((uri: string, index: number) => ({ index, uri }))
    : Array.from({ length: maxPhotos }, (_, index) => ({
        index,
        uri: photoUris[index] ?? null,
      }))

  return (
    <View style={styles.grid}>
      {slots.map(({ uri, index }) => {
        const isDisabled = index > photoUris.length

        return (
          <View key={index} style={styles.slot}>
            {uri !== null ? (
              <View style={styles.filledSlot}>
                <Image source={{ uri }} style={styles.photo} />

                {index === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryText}>
                      {t('onboarding.step2.primary')}
                    </Text>
                  </View>
                )}

                {!readOnly && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemovePhoto(index)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={colors.white}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : !readOnly ? (
              <TouchableOpacity
                style={[styles.emptySlot, isDisabled && styles.emptySlotDisabled]}
                onPress={() => handleAddPhoto(index)}
                activeOpacity={0.7}
                disabled={isDisabled}
              >
                <Ionicons
                  name="add"
                  size={28}
                  color={isDisabled ? colors.gray[300] : colors.gray[400]}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * (4 / 3),
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  filledSlot: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  primaryText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  emptySlot: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotDisabled: {
    opacity: 0.55,
  },
})
