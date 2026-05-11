import * as ImageManipulator from 'expo-image-manipulator'

const MAX_WIDTH_PX = 1080
const QUALITY = 0.8

/**
 * Compresses and resizes an image to fit within MAX_WIDTH_PX at QUALITY.
 * Returns the URI of the compressed image.
 * Always call this before storing or uploading any user photo.
 */
export const compressImage = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH_PX } }],
    {
      compress: QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  )

  return result.uri
}

/**
 * Requests media library permission and launches the image picker.
 * Returns the selected local URI after compression, or null if cancelled/denied.
 */
export const pickAndCompressImage = async (): Promise<string | null> => {
  const {
    requestMediaLibraryPermissionsAsync,
    launchImageLibraryAsync,
    MediaTypeOptions,
  } = await import('expo-image-picker')

  const { status } = await requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    return null
  }

  const result = await launchImageLibraryAsync({
    mediaTypes: MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4],
    quality: 1,
  })

  if (result.canceled || result.assets.length === 0) {
    return null
  }

  return compressImage(result.assets[0].uri)
}
