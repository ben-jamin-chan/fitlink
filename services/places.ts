import type { GymPlace } from '@/types/checkin'

interface PlaceDisplayName {
  text: string
  languageCode: string
}

interface PlaceLocation {
  latitude: number
  longitude: number
}

interface PlacePhoto {
  name: string
}

interface PlaceResult {
  id: string
  displayName: PlaceDisplayName
  formattedAddress: string
  location: PlaceLocation
  rating?: number
  photos?: PlacePhoto[]
}

interface NearbySearchResponse {
  places: PlaceResult[]
}

const PLACES_BASE_URL = 'https://places.googleapis.com/v1'

const PLACES_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos'

const INCLUDED_GYM_TYPES: string[] = ['gym', 'fitness_center', 'sports_complex']

const MAX_RESULT_COUNT = 10

/**
 * Returns EXPO_PUBLIC_GOOGLE_PLACES_API_KEY from the environment.
 *
 * IMPORTANT: This is a client-restricted key scoped to the app bundle. It must
 * never be forwarded to Cloud Functions or other server-side code. Server
 * Places lookups require a separate unrestricted server key.
 */
function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY

  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set. Add it to your .env file.'
    )
  }

  return key
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isPlaceDisplayName(value: unknown): value is PlaceDisplayName {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.text === 'string' && typeof value.languageCode === 'string'
  )
}

function isPlaceLocation(value: unknown): value is PlaceLocation {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.latitude === 'number' && typeof value.longitude === 'number'
  )
}

function isPlacePhoto(value: unknown): value is PlacePhoto {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.name === 'string'
}

function isPlaceResult(value: unknown): value is PlaceResult {
  if (!isRecord(value)) {
    return false
  }

  const hasRequiredFields =
    typeof value.id === 'string' &&
    isPlaceDisplayName(value.displayName) &&
    typeof value.formattedAddress === 'string' &&
    isPlaceLocation(value.location)

  if (!hasRequiredFields) {
    return false
  }

  const hasValidRating =
    value.rating === undefined || typeof value.rating === 'number'
  const hasValidPhotos =
    value.photos === undefined ||
    (isUnknownArray(value.photos) && value.photos.every(isPlacePhoto))

  return hasValidRating && hasValidPhotos
}

function parseNearbySearchResponse(json: unknown): NearbySearchResponse {
  if (!isRecord(json)) {
    throw new Error('Unexpected response shape from Google Places API')
  }

  if (json.places === undefined) {
    return { places: [] }
  }

  if (!isUnknownArray(json.places)) {
    throw new Error('Unexpected response shape from Google Places API')
  }

  if (!json.places.every(isPlaceResult)) {
    throw new Error('Unexpected response shape from Google Places API')
  }

  return { places: json.places }
}

function mapPlaceResult(raw: PlaceResult): GymPlace {
  const photoUrl: string | undefined =
    raw.photos !== undefined && raw.photos.length > 0
      ? getPlacePhotoUrl(raw.photos[0].name, 400)
      : undefined

  return {
    placeId: raw.id,
    name: raw.displayName.text,
    address: raw.formattedAddress,
    coordinates: {
      latitude: raw.location.latitude,
      longitude: raw.location.longitude,
    },
    rating: raw.rating,
    photoUrl,
  }
}

export async function searchNearbyGyms(
  coords: { latitude: number; longitude: number },
  radiusMeters: number
): Promise<GymPlace[]> {
  const apiKey = getApiKey()

  const requestBody = {
    includedTypes: INCLUDED_GYM_TYPES,
    maxResultCount: MAX_RESULT_COUNT,
    locationRestriction: {
      circle: {
        center: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        radius: radiusMeters,
      },
    },
  }

  const response = await fetch(`${PLACES_BASE_URL}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(
      `Google Places API error: ${response.status} ${response.statusText}`
    )
  }

  const json: unknown = await response.json()
  const data = parseNearbySearchResponse(json)

  return data.places.map(mapPlaceResult)
}

export function getPlacePhotoUrl(photoName: string, maxWidth: number): string {
  const apiKey = getApiKey()

  return `${PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`
}
