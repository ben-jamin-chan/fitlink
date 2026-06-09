import React, { useState } from 'react'

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native'

import { getInfoAsync } from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'

import { useProfileStore } from '@/store/profileStore'

import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const BYTES_PER_MEBIBYTE = 1024 * 1024
const MAX_VIDEO_BYTES = 50 * BYTES_PER_MEBIBYTE
const MAX_VIDEO_DURATION_SECONDS = 15
const THUMBNAIL_SIZE = spacing.xxxl + spacing.md

interface VideoProfilePickerProps {
  currentVideoUrl: string | undefined
}

export const VideoProfilePicker = ({
  currentVideoUrl,
}: VideoProfilePickerProps): React.JSX.Element => {
  const { t } = useTranslation()
  const { updateVideoProfile, removeVideoProfile } = useProfileStore()
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)

  const persistedVideoUrl =
    currentVideoUrl !== undefined && currentVideoUrl.length > 0
      ? currentVideoUrl
      : null
  const displayUri = localPreviewUri ?? persistedVideoUrl

  const handlePick = async (): Promise<void> => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (permission.status !== 'granted') {
      Alert.alert(
        t('profile.video.permissionTitle'),
        t('profile.video.permissionMessage'),
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
    })

    if (result.canceled || result.assets.length === 0) {
      return
    }

    const asset = result.assets[0]
    const uri = asset.uri
    const info = await getInfoAsync(uri)

    if (info.exists && info.size > MAX_VIDEO_BYTES) {
      Alert.alert(t('profile.video.tooLarge'))
      return
    }

    setLocalPreviewUri(uri)
    setIsUploading(true)

    try {
      await updateVideoProfile(uri)
    } catch {
      setLocalPreviewUri(null)
      Alert.alert(t('profile.video.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = (): void => {
    Alert.alert(
      t('profile.video.removeTitle'),
      t('profile.video.removeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.video.remove'),
          style: 'destructive',
          onPress: async (): Promise<void> => {
            setIsUploading(true)
            setLocalPreviewUri(null)

            try {
              await removeVideoProfile()
            } catch {
              Alert.alert(t('profile.video.removeError'))
            } finally {
              setIsUploading(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <LoadingOverlay
        visible={isUploading}
        message={t('profile.video.uploading')}
      />

      {displayUri !== null ? (
        <View style={styles.previewRow}>
          <Image
            source={{ uri: displayUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <View style={styles.previewActions}>
            <Text style={styles.videoLabel}>{t('profile.video.added')}</Text>
            <Pressable onPress={handlePick} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>
                {t('profile.video.change')}
              </Text>
            </Pressable>
            <Pressable onPress={handleRemove} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>
                {t('profile.video.remove')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={handlePick} style={styles.addButton}>
          <Text style={styles.addIcon}>{t('profile.video.badge')}</Text>
          <Text style={styles.addLabel}>{t('profile.video.add')}</Text>
          <Text style={styles.addHint}>{t('profile.video.hint')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderColor: colors.gray[400],
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  addHint: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  } as TextStyle,
  addIcon: {
    fontSize: typography.sizes.xxl,
    marginBottom: spacing.xs,
  } as TextStyle,
  addLabel: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  changeButton: {
    alignSelf: 'flex-start',
  } as ViewStyle,
  changeButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  container: {
    marginTop: spacing.sm,
  } as ViewStyle,
  previewActions: {
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  } as ViewStyle,
  removeButton: {
    alignSelf: 'flex-start',
  } as ViewStyle,
  removeButtonText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  thumbnail: {
    borderRadius: borderRadius.md,
    height: THUMBNAIL_SIZE,
    width: THUMBNAIL_SIZE,
  } as ImageStyle,
  videoLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
})
