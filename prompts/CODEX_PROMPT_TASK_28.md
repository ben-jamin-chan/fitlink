# CODEX PROMPT — Task 28
# Full Profile Modal

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.6 complete. Relevant existing files:

- `components/discovery/SwipeCard.tsx` — `UserProfile` rendered as card; `ActivityBadge` and `SwipeLabel` components exist
- `components/discovery/ActivityBadge.tsx` — pill chip, accepts `label: string`, `variant?: 'activity' | 'level'`
- `components/discovery/DiscoveryScreen.tsx` — calls `onTapInfo(profile)` on the top card; currently shows an `Alert` stub with a TODO comment at the `handleInfo` handler — **replace that stub with the real modal**
- `store/discoveryStore.ts` — `stack: UserProfile[]`, `swipeRight`, `swipeLeft`, `swipeSuperLike` actions available
- `store/authStore.ts` — `user.uid` and `isPremium` (or `subscription.tier`) available
- `types/user.ts` — full `UserProfile` interface with `activities`, `fitnessLevel`, `photos`, `bio`, `height`, `religion`, `lookingFor`, `lifestyle` (diet, smoking, drinking), `fitnessGoals`, `workoutFrequency`, `verified`, `lastActive`, `location`
- `constants/theme.ts` — all color, spacing, typography tokens; `colors.primary`, `colors.secondary`, `colors.danger`
- `i18n/en.json` — `discovery.*` keys already exist; new keys needed under `profile.*`

Task 28 builds the **Full Profile Modal** — a full-screen bottom-sheet-style modal that shows a scrollable deep-dive on a candidate's profile. It is opened from both the `DiscoveryScreen` (info button / card tap) and, in later tasks, from the Matches grid. This task scopes to the Discovery context only.

---

## Task 28 — Full Profile Modal

**Files to create:**
- `components/discovery/FullProfileModal.tsx`
- `components/discovery/PhotoViewer.tsx`
- `components/profile/ProfileSection.tsx`

**Files to modify:**
- `app/discovery/DiscoveryScreen.tsx` — replace `handleInfo` Alert stub with real modal
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `profile.*` keys

---

## i18n Keys to Add

Add to all four language files under the `"profile"` namespace (use English values as placeholders in non-English files):

```json
"profile": {
  "activeNow": "Active now",
  "activeHoursAgo": "Active {{hours}}h ago",
  "activeDaysAgo": "Active {{days}}d ago",
  "kmAway": "{{distance}} km away",
  "sameCity": "Same city",
  "verified": "Verified profile",
  "readMore": "Read more",
  "showLess": "Show less",
  "sections": {
    "fitness": "Fitness & Activities",
    "lifestyle": "Lifestyle",
    "about": "About",
    "inCommon": "What You Have in Common"
  },
  "fitness": {
    "level": "Fitness Level",
    "frequency": "Works out",
    "goals": "Goals"
  },
  "lifestyle": {
    "diet": "Diet",
    "smoking": "Smoking",
    "drinking": "Drinking"
  },
  "about": {
    "height": "Height",
    "religion": "Religion",
    "lookingFor": "Looking For"
  },
  "inCommon": {
    "sharedActivities": "You both love {{activity}}",
    "sharedLevel": "You're both {{level}}",
    "sharedDiet": "You both prefer {{diet}}",
    "noCommon": "Explore their profile to find out more"
  },
  "actions": {
    "report": "Report User",
    "close": "Close"
  },
  "report": {
    "title": "Report {{name}}",
    "categories": {
      "inappropriatePhotos": "Inappropriate Photos",
      "harassment": "Harassment or Bullying",
      "spam": "Spam or Scam",
      "fakeProfile": "Fake Profile",
      "underage": "Underage User",
      "solicitation": "Solicitation",
      "other": "Other"
    },
    "submit": "Submit Report",
    "submitted": "Report submitted. Thank you for keeping fitlink safe."
  }
}
```

---

## `components/profile/ProfileSection.tsx`

Reusable titled section wrapper used throughout the modal. Keeps visual rhythm consistent.

```typescript
import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { colors, spacing, typography } from '@/constants/theme'

interface ProfileSectionProps {
  title: string
  children: React.ReactNode
}

export const ProfileSection = ({ title, children }: ProfileSectionProps): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {children}
  </View>
)

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  } as TextStyle,
})
```

---

## `components/discovery/PhotoViewer.tsx`

Full-screen photo viewer modal with pinch-to-zoom (using `react-native-reanimated` scale shared value) and swipe-down to dismiss. Opened when user taps a photo inside `FullProfileModal`.

```typescript
import React from 'react'
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ViewStyle,
  ImageStyle,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '@/constants/theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface PhotoViewerProps {
  visible: boolean
  photoUri: string
  onClose: () => void
}

export const PhotoViewer = ({ visible, photoUri, onClose }: PhotoViewerProps): React.JSX.Element => {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value < 1.05) {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 })
        savedScale.value = 1
      }
    })

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow pan-to-dismiss when not zoomed in
      if (savedScale.value <= 1) {
        translateY.value = savedTranslateY.value + e.translationY
      }
    })
    .onEnd((e) => {
      if (savedScale.value <= 1 && Math.abs(e.translationY) > 100) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 })
        savedTranslateY.value = 0
      }
    })

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }))

  const handleClose = (): void => {
    // Reset state on close
    scale.value = 1
    savedScale.value = 1
    translateY.value = 0
    savedTranslateY.value = 0
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.backdrop}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageWrapper, animatedStyle]}>
            <Image
              source={{ uri: photoUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  closeButton: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  } as ViewStyle,
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  } as ImageStyle,
})
```

---

## `components/discovery/FullProfileModal.tsx`

Full-screen modal with:
- Swipe-down gesture to dismiss (Reanimated 3 `Gesture.Pan()`)
- Scrollable content with all profile sections
- Fixed bottom action bar (Pass, Like, Super Like)
- Report flow (category sheet → confirmation)
- "What You Have in Common" section comparing viewer's profile with candidate's

The modal receives the **viewing user's profile** (`viewerProfile`) and the **candidate's profile** (`profile`) to compute shared interests. It calls the `discoveryStore` actions directly so the swipe is registered identically to a gesture swipe.

```typescript
import React, { useState, useCallback } from 'react'
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { ProfileSection } from '@/components/profile/ProfileSection'
import { ActivityBadge } from '@/components/discovery/ActivityBadge'
import { PhotoViewer } from '@/components/discovery/PhotoViewer'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'
import type { UserProfile } from '@/types/user'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const DISMISS_THRESHOLD = 120    // px drag-down to dismiss

// ─── Helper: compute "last active" label ────────────────────────────────────

const getActiveLabel = (lastActive: UserProfile['lastActive'], t: (key: string, opts?: Record<string, unknown>) => string): string => {
  if (!lastActive) return ''
  const now = Date.now()
  // Firestore Timestamp has .toMillis(); plain number also accepted
  const ms = typeof lastActive === 'number'
    ? lastActive
    : lastActive.toMillis()
  const diffMs = now - ms
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return t('profile.activeNow')
  if (hours < 24) return t('profile.activeHoursAgo', { hours })
  const days = Math.floor(hours / 24)
  return t('profile.activeDaysAgo', { days })
}

// ─── Helper: compute shared interests ───────────────────────────────────────

interface SharedInterests {
  activities: string[]
  sameLevel: boolean
  sameDiet: boolean
}

const computeSharedInterests = (
  viewer: UserProfile | null,
  candidate: UserProfile
): SharedInterests => {
  if (!viewer) return { activities: [], sameLevel: false, sameDiet: false }
  const activities = viewer.activities.filter((a) => candidate.activities.includes(a))
  const sameLevel = viewer.fitnessLevel === candidate.fitnessLevel
  const sameDiet =
    viewer.dietaryPreference === candidate.dietaryPreference &&
    viewer.dietaryPreference !== 'No preference'
  return { activities, sameLevel, sameDiet }
}

// ─── Report categories ───────────────────────────────────────────────────────

const REPORT_CATEGORIES = [
  'inappropriatePhotos',
  'harassment',
  'spam',
  'fakeProfile',
  'underage',
  'solicitation',
  'other',
] as const

type ReportCategory = typeof REPORT_CATEGORIES[number]

// ─── Props ───────────────────────────────────────────────────────────────────

interface FullProfileModalProps {
  visible: boolean
  profile: UserProfile | null
  viewerProfile: UserProfile | null
  onClose: () => void
  /** Called after a like/pass/super-like action so DiscoveryScreen can advance the stack */
  onActionComplete: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FullProfileModal = ({
  visible,
  profile,
  viewerProfile,
  onClose,
  onActionComplete,
}: FullProfileModalProps): React.JSX.Element => {
  const { t } = useTranslation()
  const { swipeRight, swipeLeft, swipeSuperLike } = useDiscoveryStore()

  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)

  // Swipe-down to dismiss
  const translateY = useSharedValue(0)
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        runOnJS(onClose)()
      }
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 })
    })

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  // ─── Guard: nothing to render if no profile ───────────────────────────────

  if (!profile) return <View />

  const shared = computeSharedInterests(viewerProfile, profile)
  const photos = profile.photos ?? []
  const bio = profile.bio ?? ''
  const BIO_TRUNCATE = 200
  const isBioLong = bio.length > BIO_TRUNCATE
  const displayBio = bioExpanded || !isBioLong ? bio : `${bio.slice(0, BIO_TRUNCATE)}…`

  // ─── Action handlers ──────────────────────────────────────────────────────

  const handleLike = useCallback(async (): Promise<void> => {
    await swipeRight(profile.uid)
    onClose()
    onActionComplete()
  }, [profile.uid, swipeRight, onClose, onActionComplete])

  const handlePass = useCallback(async (): Promise<void> => {
    await swipeLeft(profile.uid)
    onClose()
    onActionComplete()
  }, [profile.uid, swipeLeft, onClose, onActionComplete])

  const handleSuperLike = useCallback(async (): Promise<void> => {
    await swipeSuperLike(profile.uid)
    onClose()
    onActionComplete()
  }, [profile.uid, swipeSuperLike, onClose, onActionComplete])

  const handleReport = useCallback((category: ReportCategory): void => {
    setShowReportSheet(false)
    // Firestore write deferred to Task 38 (Settings) where reportService lives
    // For now: log + toast
    Alert.alert(t('profile.report.submitted'))
    onClose()
  }, [t, onClose])

  // ─── Photo carousel ───────────────────────────────────────────────────────

  const handlePhotoTap = (side: 'left' | 'right' | 'center'): void => {
    if (side === 'center') {
      setPhotoViewerVisible(true)
      return
    }
    if (side === 'left' && activePhotoIndex > 0) {
      setActivePhotoIndex((i) => i - 1)
    }
    if (side === 'right' && activePhotoIndex < photos.length - 1) {
      setActivePhotoIndex((i) => i + 1)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.modalContainer, animatedModalStyle]}>

            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Header icons (close + report) */}
            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={onClose} style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.gray[700]} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowReportSheet(true)}
                style={styles.iconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="flag-outline" size={22} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            {/* Scrollable profile content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              {/* ── Photo carousel ── */}
              {photos.length > 0 && (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: photos[activePhotoIndex] }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  {/* Left tap zone */}
                  <TouchableOpacity
                    style={styles.photoTapLeft}
                    onPress={() => handlePhotoTap('left')}
                    activeOpacity={1}
                  />
                  {/* Center tap → fullscreen */}
                  <TouchableOpacity
                    style={styles.photoTapCenter}
                    onPress={() => handlePhotoTap('center')}
                    activeOpacity={1}
                  />
                  {/* Right tap zone */}
                  <TouchableOpacity
                    style={styles.photoTapRight}
                    onPress={() => handlePhotoTap('right')}
                    activeOpacity={1}
                  />
                  {/* Pagination dots */}
                  {photos.length > 1 && (
                    <View style={styles.paginationDots}>
                      {photos.map((_, i) => (
                        <View
                          key={i}
                          style={[styles.dot, i === activePhotoIndex && styles.dotActive]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* ── Basic info ── */}
              <View style={styles.basicInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{profile.firstName}, {profile.age}</Text>
                  {profile.verified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.secondary}
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.gray[500]} />
                  <Text style={styles.metaText}>{profile.location.city}</Text>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>
                    {getActiveLabel(profile.lastActive, t)}
                  </Text>
                </View>
              </View>

              {/* ── Bio ── */}
              {bio.length > 0 && (
                <View style={styles.bioContainer}>
                  <Text style={styles.bioText}>{displayBio}</Text>
                  {isBioLong && (
                    <TouchableOpacity onPress={() => setBioExpanded((v) => !v)}>
                      <Text style={styles.readMore}>
                        {bioExpanded ? t('profile.showLess') : t('profile.readMore')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ── Fitness & Activities ── */}
              <ProfileSection title={t('profile.sections.fitness')}>
                <View style={styles.badgeRow}>
                  {profile.activities.map((activity) => (
                    <ActivityBadge
                      key={activity}
                      label={activity}
                      variant={shared.activities.includes(activity) ? 'shared' : 'activity'}
                    />
                  ))}
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.fitness.level')}</Text>
                  <ActivityBadge label={profile.fitnessLevel} variant="level" />
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.fitness.frequency')}</Text>
                  <Text style={styles.infoValue}>{profile.workoutFrequency}</Text>
                </View>
                {profile.fitnessGoals.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.fitness.goals')}</Text>
                    <Text style={styles.infoValue}>{profile.fitnessGoals.join(', ')}</Text>
                  </View>
                )}
              </ProfileSection>

              {/* ── Lifestyle ── */}
              <ProfileSection title={t('profile.sections.lifestyle')}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.lifestyle.diet')}</Text>
                  <Text style={styles.infoValue}>{profile.dietaryPreference}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.lifestyle.smoking')}</Text>
                  <Text style={styles.infoValue}>{profile.smoking}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.lifestyle.drinking')}</Text>
                  <Text style={styles.infoValue}>{profile.drinking}</Text>
                </View>
              </ProfileSection>

              {/* ── About ── */}
              <ProfileSection title={t('profile.sections.about')}>
                {profile.height && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.about.height')}</Text>
                    <Text style={styles.infoValue}>{profile.height} cm</Text>
                  </View>
                )}
                {profile.religion && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.about.religion')}</Text>
                    <Text style={styles.infoValue}>{profile.religion}</Text>
                  </View>
                )}
                {profile.lookingFor.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.about.lookingFor')}</Text>
                    <Text style={styles.infoValue}>{profile.lookingFor.join(', ')}</Text>
                  </View>
                )}
              </ProfileSection>

              {/* ── What You Have in Common ── */}
              <ProfileSection title={t('profile.sections.inCommon')}>
                {shared.activities.length === 0 && !shared.sameLevel && !shared.sameDiet ? (
                  <Text style={styles.infoValue}>{t('profile.inCommon.noCommon')}</Text>
                ) : (
                  <>
                    {shared.activities.slice(0, 3).map((activity) => (
                      <View key={activity} style={styles.inCommonRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={styles.inCommonText}>
                          {t('profile.inCommon.sharedActivities', { activity })}
                        </Text>
                      </View>
                    ))}
                    {shared.sameLevel && (
                      <View style={styles.inCommonRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={styles.inCommonText}>
                          {t('profile.inCommon.sharedLevel', { level: profile.fitnessLevel })}
                        </Text>
                      </View>
                    )}
                    {shared.sameDiet && (
                      <View style={styles.inCommonRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={styles.inCommonText}>
                          {t('profile.inCommon.sharedDiet', { diet: profile.dietaryPreference })}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ProfileSection>

              {/* Bottom padding for action bar */}
              <View style={styles.actionBarSpacer} />
            </ScrollView>

            {/* ── Fixed bottom action bar ── */}
            <View style={styles.actionBar}>
              {/* Pass */}
              <TouchableOpacity style={[styles.actionButton, styles.passButton]} onPress={handlePass} activeOpacity={0.8}>
                <Ionicons name="close" size={28} color={colors.danger} />
              </TouchableOpacity>
              {/* Super Like */}
              <TouchableOpacity style={[styles.actionButton, styles.superLikeButton]} onPress={handleSuperLike} activeOpacity={0.8}>
                <Ionicons name="star" size={26} color={colors.secondary} />
              </TouchableOpacity>
              {/* Like */}
              <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={handleLike} activeOpacity={0.8}>
                <Ionicons name="heart" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>

          </Animated.View>
        </GestureDetector>
      </Modal>

      {/* Report category sheet */}
      <Modal
        visible={showReportSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowReportSheet(false)}
        >
          <View style={styles.reportSheet}>
            <Text style={styles.reportTitle}>
              {t('profile.report.title', { name: profile.firstName })}
            </Text>
            {REPORT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.reportOption}
                onPress={() => handleReport(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.reportOptionText}>
                  {t(`profile.report.categories.${cat}`)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.reportCancel} onPress={() => setShowReportSheet(false)}>
              <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen photo viewer */}
      <PhotoViewer
        visible={photoViewerVisible}
        photoUri={photos[activePhotoIndex] ?? ''}
        onClose={() => setPhotoViewerVisible(false)}
      />
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PHOTO_HEIGHT = SCREEN_HEIGHT * 0.45

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  } as ViewStyle,
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  } as ViewStyle,
  headerIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  iconButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  } as ViewStyle,
  scrollView: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    paddingBottom: spacing.xxxl,
  } as ViewStyle,

  // Photo carousel
  photoContainer: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
    marginBottom: spacing.lg,
  } as ViewStyle,
  photo: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  photoTapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '25%',
    height: '100%',
  } as ViewStyle,
  photoTapCenter: {
    position: 'absolute',
    left: '25%',
    top: 0,
    width: '50%',
    height: '100%',
  } as ViewStyle,
  photoTapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '25%',
    height: '100%',
  } as ViewStyle,
  paginationDots: {
    position: 'absolute',
    bottom: spacing.sm,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    opacity: 0.5,
  } as ViewStyle,
  dotActive: {
    opacity: 1,
    width: 18,
  } as ViewStyle,

  // Basic info
  basicInfo: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  } as ViewStyle,
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  } as ViewStyle,
  name: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
  } as TextStyle,
  verifiedIcon: {
    marginLeft: spacing.xs,
  } as ViewStyle,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
  } as TextStyle,
  metaDivider: {
    fontSize: typography.sizes.sm,
    color: colors.gray[400],
  } as TextStyle,

  // Bio
  bioContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  } as ViewStyle,
  bioText: {
    fontSize: typography.sizes.md,
    color: colors.gray[700],
    lineHeight: 24,
  } as TextStyle,
  readMore: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  } as TextStyle,

  // Section padding wrapper (ProfileSection adds its own title; we pad horizontal here)
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
  } as TextStyle,
  infoValue: {
    fontSize: typography.sizes.sm,
    color: colors.gray[800],
    fontWeight: typography.weights.medium,
    flexShrink: 1,
    textAlign: 'right',
  } as TextStyle,

  // In Common
  inCommonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  } as ViewStyle,
  inCommonText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[700],
  } as TextStyle,

  // Action bar
  actionBarSpacer: {
    height: 100,
  } as ViewStyle,
  actionBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  } as ViewStyle,
  passButton: {
    borderWidth: 1.5,
    borderColor: colors.danger,
  } as ViewStyle,
  superLikeButton: {
    borderWidth: 1.5,
    borderColor: colors.secondary,
  } as ViewStyle,
  likeButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  } as ViewStyle,

  // Report sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  } as ViewStyle,
  reportSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  } as ViewStyle,
  reportTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  } as TextStyle,
  reportOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  } as ViewStyle,
  reportOptionText: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  } as TextStyle,
  reportCancel: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  } as ViewStyle,
  reportCancelText: {
    fontSize: typography.sizes.md,
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
})
```

---

## `app/discovery/DiscoveryScreen.tsx` — Modifications

Replace the `handleInfo` Alert stub and wire `FullProfileModal`. Also pass `viewerProfile` from `profileStore`.

**Add import:**
```typescript
import { FullProfileModal } from '@/components/discovery/FullProfileModal'
import { useProfileStore } from '@/store/profileStore'
```

**Add state inside component:**
```typescript
const { profile: viewerProfile } = useProfileStore()
const [modalProfile, setModalProfile] = useState<UserProfile | null>(null)
```

**Replace the handleInfo stub:**
```typescript
// BEFORE (stub):
const handleInfo = (): void => {
  Alert.alert('TODO', 'FullProfileModal coming in Task 28')
}

// AFTER:
const handleInfo = (): void => {
  const topProfile = stack[currentIndex] ?? null
  setModalProfile(topProfile)
}
```

**Add modal JSX at end of return, before closing tag:**
```tsx
<FullProfileModal
  visible={modalProfile !== null}
  profile={modalProfile}
  viewerProfile={viewerProfile}
  onClose={() => setModalProfile(null)}
  onActionComplete={() => {
    setModalProfile(null)
    advanceStack()
  }}
/>
```

> `advanceStack` should already be called by the existing swipe handlers via `discoveryStore`. Ensure `onActionComplete` calls the same `advanceStack` function used by gesture swipes so the stack index moves consistently.

---

## `components/discovery/ActivityBadge.tsx` — Add `shared` variant

The existing `ActivityBadge` has `activity` and `level` variants. Add `shared` so that activities in common are highlighted in `colors.primary` background:

```typescript
// Add to existing variant style map:
shared: {
  backgroundColor: colors.primary + '22',   // 13% opacity tint
  borderColor: colors.primary,
  borderWidth: 1,
},
sharedText: {
  color: colors.primary,
  fontWeight: typography.weights.semibold,
},
```

If `ActivityBadge` uses a `variant` prop already typed as `'activity' | 'level'`, extend the union to `'activity' | 'level' | 'shared'`.

---

## Architecture Notes for Codex

1. **No Firebase reads in this task.** `FullProfileModal` receives `profile: UserProfile` from `DiscoveryScreen` which already has the full profile in `discoveryStore.stack`. Do not add any Firestore `getDoc` calls here.

2. **Swipe actions delegate to `discoveryStore`.** `handleLike`, `handlePass`, and `handleSuperLike` in the modal call `swipeRight`, `swipeLeft`, `swipeSuperLike` from the store — the exact same functions called by gesture swipes in `DiscoveryScreen`. This ensures the swipe is written to Firestore and the daily limit counter is respected.

3. **`onActionComplete` advances the stack.** After a like/pass/super-like from the modal, `DiscoveryScreen` must advance `currentIndex` the same way a gesture swipe does. `onActionComplete` is the hook for this — it calls whatever `advanceStack` mechanism exists in `DiscoveryScreen`.

4. **Report submission is a stub.** The `handleReport` function logs the category and shows an Alert. Full Firestore write (`addDoc` to `/reports`) is deferred to Task 38 when the reporting service is established. Leave a `// TODO Task 38: submit report to Firestore` comment.

5. **`GestureHandlerRootView` is at app root (App.tsx).** Do not add another `GestureHandlerRootView` inside `FullProfileModal` or `PhotoViewer` except where `Modal` creates a new RN root. The `PhotoViewer` wraps with `GestureHandlerRootView` because React Native `Modal` renders outside the main component tree and loses gesture context.

6. **`ProfileSection` horizontal padding.** `ProfileSection` renders its children directly — it applies no horizontal padding itself. Each child (badge row, info row) is responsible for its own `paddingHorizontal: spacing.lg`. This keeps the section title flush with the badge rows.

7. **`ActivityBadge` `shared` variant.** Shared activities are detected by `computeSharedInterests` and passed as the `variant="shared"` prop. Non-shared activities use `variant="activity"` as before. Do not add any logic inside `ActivityBadge` to determine sharing — it remains a dumb presentational component.

8. **`borderRadius.full` and `borderRadius.xl`.** Confirm these values exist in `constants/theme.ts`. If only `borderRadius.md` is defined, add `xl: 24` and `full: 9999` to the `borderRadius` object in `constants/theme.ts`. Do not hardcode numeric values in component files.

---

## Acceptance Criteria

- [ ] `ProfileSection` renders with section title and children, zero inline styles
- [ ] `PhotoViewer` opens from tap on center of photo in modal, pinch-to-zoom works, swipe-down dismisses
- [ ] `FullProfileModal` opens when `handleInfo` is triggered from `DiscoveryScreen`
- [ ] Drag handle is visible; swipe-down gesture dismisses modal
- [ ] Photo carousel: tap left → previous photo, tap right → next photo, pagination dots update
- [ ] Pagination dots visible only if user has more than 1 photo
- [ ] Name, age, verified checkmark, location, active label all display correctly
- [ ] Bio longer than 200 chars shows "Read more" toggle; expands and collapses
- [ ] Fitness section shows all activities; activities shared with viewer are highlighted (`shared` variant on `ActivityBadge`)
- [ ] Lifestyle section shows diet, smoking, drinking
- [ ] About section shows height, religion (if set), looking for
- [ ] "What You Have in Common" section shows checkmark rows for shared activities (max 3), level, diet; falls back to "no common" text if none
- [ ] Pass, Like, Super Like buttons in action bar call correct `discoveryStore` actions
- [ ] After action: modal closes, `onActionComplete` fires, stack advances
- [ ] Report button opens category sheet; tapping a category dismisses sheet, shows Alert, modal closes
- [ ] `ActivityBadge` renders `shared` variant without TypeScript error
- [ ] `DiscoveryScreen` TODO stub removed, modal state wired correctly
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero inline styles
- [ ] All strings through `t()`

## Do Not Touch
`store/discoveryStore.ts` (no new state needed), `store/onboardingStore.ts`, `services/firebase/`, `functions/`, `types/`, `App.tsx`, `app/navigation/`, all auth and onboarding screens, `components/discovery/SwipeCard.tsx`, `components/discovery/SwipeLabel.tsx`

## Commit
`git commit -m "task-28: full profile modal with photo viewer, shared interests, and action bar"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3.7] — YYYY-MM-DD
### Completed
- Task 28: FullProfileModal built — scrollable profile, photo carousel, shared interest highlights, action bar
- PhotoViewer component created — pinch-to-zoom, swipe-down to dismiss
- ProfileSection reusable section wrapper created
- ActivityBadge extended with 'shared' variant (highlighted shared activities)
- DiscoveryScreen handleInfo stub replaced with real modal wiring
- Report category sheet implemented (Firestore write stubbed, TODO Task 38)
- i18n profile.* keys added to all 4 language files

### Files Created / Modified
- components/discovery/FullProfileModal.tsx: full scrollable modal, photo carousel, sections, action bar, report sheet
- components/discovery/PhotoViewer.tsx: fullscreen viewer, pinch-to-zoom, swipe-down dismiss
- components/profile/ProfileSection.tsx: reusable titled section wrapper
- components/discovery/ActivityBadge.tsx: 'shared' variant added
- app/discovery/DiscoveryScreen.tsx: handleInfo stub replaced, FullProfileModal wired with modalProfile state
- i18n/en.json, my.json, zh.json, ta.json: profile.* namespace added

### Known Issues / Deferred
- Report Firestore write (addDoc to /reports) deferred to Task 38 (SettingsScreen reporting service)
- Distance display (X km away) shows city name only — geo-distance calculation deferred to Phase 2
- Pinch-to-zoom on card photos inside SwipeCard still not implemented — interaction model differs from modal

### Next Up
- Task 29: Match Store (Firestore real-time listener on /matches, MatchWithProfile type resolution, unmatch action)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 29 prompt.

---

## Reasoning Level
Medium–High
