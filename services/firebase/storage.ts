import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage'

import { auth, storage } from '@/services/firebase/config'

import { compressImage } from '@/utils/imageUtils'

const PROFILE_PHOTO_CONTENT_TYPE = 'image/jpeg'

export const uploadProfilePhoto = async (
  userId: string,
  index: number,
  uri: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  const response = await fetch(uri)
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

export const uploadVerificationSelfie = async (
  localUri: string
): Promise<string> => {
  const currentUser = auth.currentUser

  if (currentUser === null) {
    throw new Error('User not authenticated')
  }

  const storagePath = `users/${currentUser.uid}/verification/selfie_temp.jpg`
  const storageRef = ref(storage, storagePath)
  const response = await fetch(localUri)
  const blob = await response.blob()

  await new Promise<void>((resolve, reject): void => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: PROFILE_PHOTO_CONTENT_TYPE,
    })

    task.on('state_changed', undefined, reject, resolve)
  })

  return storagePath
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
    const compressedUri = await compressImage(localUri)
    const downloadUrl = await uploadProfilePhoto(
      userId,
      index,
      compressedUri,
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
  try {
    const photoRef = ref(storage, downloadUrl)
    await deleteObject(photoRef)
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'storage/object-not-found'
    ) {
      return
    }

    throw error
  }
}
