import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'

import { storage } from '@/services/firebase/config'

import { compressImage } from '@/utils/imageUtils'

const PROFILE_PHOTO_CONTENT_TYPE = 'image/jpeg'

export const uploadProfilePhoto = async (
  userId: string,
  index: number,
  localUri: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  const compressedUri = await compressImage(localUri)
  const response = await fetch(compressedUri)
  const blob = await response.blob()
  const filename = `users/${userId}/photos/photo_${index}_${Date.now()}.jpg`
  const storageRef = ref(storage, filename)

  onProgress?.(10)

  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: PROFILE_PHOTO_CONTENT_TYPE,
  })

  onProgress?.(100)

  return getDownloadURL(snapshot.ref)
}

export const uploadAllProfilePhotos = async (
  userId: string,
  localUris: string[],
  onProgress?: (percent: number) => void
): Promise<string[]> => {
  const downloadUrls: string[] = []
  const total = localUris.length

  // Upload sequentially for mobile reliability; avoid parallel Storage uploads.
  for (let index = 0; index < total; index += 1) {
    const localUri = localUris[index]
    const downloadUrl = await uploadProfilePhoto(
      userId,
      index,
      localUri,
      (singlePercent: number): void => {
        if (onProgress === undefined) {
          return
        }

        const overallPercent = Math.round(
          ((index + singlePercent / 100) / total) * 100
        )
        onProgress(overallPercent)
      }
    )

    downloadUrls.push(downloadUrl)
  }

  return downloadUrls
}

export const deleteProfilePhoto = async (
  downloadUrl: string
): Promise<void> => {
  const photoRef = ref(storage, downloadUrl)
  await deleteObject(photoRef)
}
