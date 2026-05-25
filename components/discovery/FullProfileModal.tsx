import React, { useEffect, useState } from 'react'

import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { useDiscoveryStore } from '@/store/discoveryStore'

import { ActivityBadge } from '@/components/discovery/ActivityBadge'
import { PhotoViewer } from '@/components/discovery/PhotoViewer'
import { ProfileSection } from '@/components/profile/ProfileSection'

import type { LookingFor, UserProfile } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const DISMISS_THRESHOLD = spacing.xxxl + spacing.xl + spacing.xs
const SPRING_CONFIG = { damping: 20, stiffness: 200 }
const ONE_HOUR_IN_MS = 1000 * 60 * 60
const HOURS_IN_DAY = 24
const BIO_TRUNCATE_LENGTH = 200
const PHOTO_HEIGHT = SCREEN_HEIGHT * 0.45
const DRAG_HANDLE_WIDTH = spacing.xl + spacing.sm
const DRAG_HANDLE_HEIGHT = spacing.xs
const DOT_SIZE = spacing.xs + spacing.xs / 2
const DOT_ACTIVE_WIDTH = spacing.lg
const ACTION_BUTTON_SIZE = spacing.xxl + spacing.md
const ACTION_ICON_SIZE = spacing.xl - spacing.xs
const SUPER_LIKE_ICON_SIZE = spacing.xl - spacing.sm + spacing.xs / 2
const MAX_SHARED_ACTIVITIES = 3

type ReportCategory =
  | 'inappropriatePhotos'
  | 'harassment'
  | 'spam'
  | 'fakeProfile'
  | 'underage'
  | 'solicitation'
  | 'other'

const REPORT_CATEGORIES: ReportCategory[] = [
  'inappropriatePhotos',
  'harassment',
  'spam',
  'fakeProfile',
  'underage',
  'solicitation',
  'other',
]

interface SharedInterests {
  activities: string[]
  sameLevel: boolean
  sameDiet: boolean
}

interface FullProfileModalProps {
  visible: boolean
  profile: UserProfile | null
  viewerProfile: UserProfile | null
  onClose: () => void
  onActionComplete: () => void
}

const getActiveLabel = (
  lastActive: UserProfile['lastActive'],
  t: TFunction,
): string => {
  const diffMs = Date.now() - lastActive.toMillis()
  const hours = Math.floor(diffMs / ONE_HOUR_IN_MS)

  if (hours < 1) {
    return t('profile.activeNow')
  }

  if (hours < HOURS_IN_DAY) {
    return t('profile.activeHoursAgo', { hours })
  }

  return t('profile.activeDaysAgo', { days: Math.floor(hours / HOURS_IN_DAY) })
}

const computeSharedInterests = (
  viewer: UserProfile | null,
  candidate: UserProfile,
): SharedInterests => {
  if (!viewer) {
    return { activities: [], sameLevel: false, sameDiet: false }
  }

  const activities = viewer.activities.filter((activity) =>
    candidate.activities.includes(activity),
  )
  const sameLevel = viewer.fitnessLevel === candidate.fitnessLevel
  const sameDiet =
    viewer.dietaryPreference === candidate.dietaryPreference &&
    viewer.dietaryPreference !== '' &&
    viewer.dietaryPreference !== 'No preference'

  return { activities, sameLevel, sameDiet }
}

const getLookingForLabel = (value: LookingFor, t: TFunction): string => {
  return t(`profile.lookingFor.${value}`)
}

export const FullProfileModal = ({
  visible,
  profile,
  viewerProfile,
  onClose,
  onActionComplete,
}: FullProfileModalProps): React.JSX.Element | null => {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.uid)
  const swipeRight = useDiscoveryStore((state) => state.swipeRight)
  const swipeLeft = useDiscoveryStore((state) => state.swipeLeft)
  const swipeSuperLike = useDiscoveryStore((state) => state.swipeSuperLike)

  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)

  const translateY = useSharedValue(0)

  useEffect(() => {
    setActivePhotoIndex(0)
    setPhotoViewerVisible(false)
    setBioExpanded(false)
    setShowReportSheet(false)
    translateY.value = 0
  }, [profile?.uid, translateY])

  const handleSwipeClose = (): void => {
    onClose()
  }

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        runOnJS(handleSwipeClose)()
      }

      translateY.value = withSpring(0, SPRING_CONFIG)
    })

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  if (!profile) {
    return null
  }

  const shared = computeSharedInterests(viewerProfile, profile)
  const photos = profile.photos
  const bio = profile.bio
  const isBioLong = bio.length > BIO_TRUNCATE_LENGTH
  const displayBio =
    bioExpanded || !isBioLong
      ? bio
      : t('profile.bioTruncated', {
          bio: bio.slice(0, BIO_TRUNCATE_LENGTH),
        })
  const closeAfterAction = (): void => {
    onClose()
    onActionComplete()
  }

  const handleLike = (): void => {
    if (!userId) {
      return
    }

    void swipeRight(profile.uid).then(() => {
      if (!useDiscoveryStore.getState().isUpsellVisible) {
        closeAfterAction()
      }
    })
  }

  const handlePass = (): void => {
    if (!userId) {
      return
    }

    void swipeLeft(userId, profile.uid).then(closeAfterAction)
  }

  const handleSuperLike = (): void => {
    if (!userId) {
      return
    }

    void swipeSuperLike(profile.uid).then(() => {
      if (!useDiscoveryStore.getState().isUpsellVisible) {
        closeAfterAction()
      }
    })
  }

  const handleReport = (_category: ReportCategory): void => {
    setShowReportSheet(false)
    // TODO Task 38: submit report to Firestore
    Alert.alert(t('profile.report.submitted'))
    onClose()
  }

  const handlePhotoTap = (side: 'left' | 'center' | 'right'): void => {
    if (side === 'center') {
      setPhotoViewerVisible(true)
      return
    }

    if (side === 'left') {
      setActivePhotoIndex((index) => Math.max(index - 1, 0))
      return
    }

    setActivePhotoIndex((index) => Math.min(index + 1, photos.length - 1))
  }

  const fitnessLevelLabel = t(
    `onboarding.step3.fitnessLevelOptions.${profile.fitnessLevel}`,
  )
  const smokingLabel = t(`onboarding.step4.smoking.options.${profile.smoking}`)
  const drinkingLabel = t(
    `onboarding.step4.drinking.options.${profile.drinking}`,
  )
  const lookingForLabels = profile.lookingFor.map((value) =>
    getLookingForLabel(value, t),
  )

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
            <View style={styles.dragHandle} />

            <View style={styles.headerIcons}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.iconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.gray[700]} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowReportSheet(true)}
                style={styles.iconButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="flag-outline"
                  size={22}
                  color={colors.gray[500]}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              {photos.length > 0 && (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: photos[activePhotoIndex] }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.photoTapLeft}
                    onPress={() => handlePhotoTap('left')}
                    activeOpacity={1}
                  />
                  <TouchableOpacity
                    style={styles.photoTapCenter}
                    onPress={() => handlePhotoTap('center')}
                    activeOpacity={1}
                  />
                  <TouchableOpacity
                    style={styles.photoTapRight}
                    onPress={() => handlePhotoTap('right')}
                    activeOpacity={1}
                  />

                  {photos.length > 1 && (
                    <View style={styles.paginationDots}>
                      {photos.map((photo, index) => (
                        <View
                          key={photo}
                          style={[
                            styles.dot,
                            index === activePhotoIndex
                              ? styles.dotActive
                              : styles.dotInactive,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.basicInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {profile.firstName}, {profile.age}
                  </Text>
                  {profile.photoVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.secondary}
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={colors.gray[500]}
                  />
                  <Text style={styles.metaText}>{profile.location.city}</Text>
                  <Text style={styles.metaDivider}>
                    {t('profile.metaSeparator')}
                  </Text>
                  <Text style={styles.metaText}>
                    {getActiveLabel(profile.lastActive, t)}
                  </Text>
                </View>
              </View>

              {bio.length > 0 && (
                <View style={styles.bioContainer}>
                  <Text style={styles.bioText}>{displayBio}</Text>
                  {isBioLong && (
                    <TouchableOpacity
                      onPress={() => setBioExpanded((expanded) => !expanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.readMore}>
                        {bioExpanded
                          ? t('profile.showLess')
                          : t('profile.readMore')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <ProfileSection title={t('profile.sections.fitness')}>
                <View style={styles.badgeRow}>
                  {profile.activities.map((activity) => (
                    <ActivityBadge
                      key={activity}
                      label={activity}
                      variant={
                        shared.activities.includes(activity)
                          ? 'shared'
                          : 'activity'
                      }
                    />
                  ))}
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.fitness.level')}
                  </Text>
                  <ActivityBadge label={fitnessLevelLabel} variant="level" />
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.fitness.frequency')}
                  </Text>
                  <Text style={styles.infoValue}>
                    {profile.workoutFrequency}
                  </Text>
                </View>
                {profile.fitnessGoals.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.fitness.goals')}
                    </Text>
                    <Text style={styles.infoValue}>
                      {profile.fitnessGoals.join(', ')}
                    </Text>
                  </View>
                )}
              </ProfileSection>

              <ProfileSection title={t('profile.sections.lifestyle')}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.lifestyle.diet')}
                  </Text>
                  <Text style={styles.infoValue}>
                    {profile.dietaryPreference}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.lifestyle.smoking')}
                  </Text>
                  <Text style={styles.infoValue}>{smokingLabel}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.lifestyle.drinking')}
                  </Text>
                  <Text style={styles.infoValue}>{drinkingLabel}</Text>
                </View>
              </ProfileSection>

              <ProfileSection title={t('profile.sections.about')}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {t('profile.about.height')}
                  </Text>
                  <Text style={styles.infoValue}>
                    {t('profile.about.heightCm', { height: profile.height })}
                  </Text>
                </View>
                {profile.religion && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.about.religion')}
                    </Text>
                    <Text style={styles.infoValue}>{profile.religion}</Text>
                  </View>
                )}
                {lookingForLabels.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.about.lookingFor')}
                    </Text>
                    <Text style={styles.infoValue}>
                      {lookingForLabels.join(', ')}
                    </Text>
                  </View>
                )}
              </ProfileSection>

              <ProfileSection title={t('profile.sections.inCommon')}>
                {shared.activities.length === 0 &&
                !shared.sameLevel &&
                !shared.sameDiet ? (
                  <Text style={styles.inCommonEmpty}>
                    {t('profile.inCommon.noCommon')}
                  </Text>
                ) : (
                  <>
                    {shared.activities
                      .slice(0, MAX_SHARED_ACTIVITIES)
                      .map((activity) => (
                        <View key={activity} style={styles.inCommonRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={styles.inCommonText}>
                            {t('profile.inCommon.sharedActivities', {
                              activity,
                            })}
                          </Text>
                        </View>
                      ))}
                    {shared.sameLevel && (
                      <View style={styles.inCommonRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.primary}
                        />
                        <Text style={styles.inCommonText}>
                          {t('profile.inCommon.sharedLevel', {
                            level: fitnessLevelLabel,
                          })}
                        </Text>
                      </View>
                    )}
                    {shared.sameDiet && (
                      <View style={styles.inCommonRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.primary}
                        />
                        <Text style={styles.inCommonText}>
                          {t('profile.inCommon.sharedDiet', {
                            diet: profile.dietaryPreference,
                          })}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ProfileSection>

              <View style={styles.actionBarSpacer} />
            </ScrollView>

            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[styles.actionButton, styles.passButton]}
                onPress={handlePass}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close"
                  size={ACTION_ICON_SIZE}
                  color={colors.danger}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.superLikeButton]}
                onPress={handleSuperLike}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="star"
                  size={SUPER_LIKE_ICON_SIZE}
                  color={colors.secondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.likeButton]}
                onPress={handleLike}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="heart"
                  size={ACTION_ICON_SIZE}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>
      </Modal>

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
            {REPORT_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={styles.reportOption}
                onPress={() => handleReport(category)}
                activeOpacity={0.7}
              >
                <Text style={styles.reportOptionText}>
                  {t(`profile.report.categories.${category}`)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.gray[400]}
                />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.reportCancel}
              onPress={() => setShowReportSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.reportCancelText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <PhotoViewer
        visible={photoViewerVisible}
        photoUri={photos[activePhotoIndex] ?? ''}
        onClose={() => setPhotoViewerVisible(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  actionBar: {
    bottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: spacing.xl,
    position: 'absolute',
    right: 0,
  },
  actionBarSpacer: {
    height: spacing.xxxl + spacing.xxl,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    elevation: 4,
    height: ACTION_BUTTON_SIZE,
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: spacing.sm,
    width: ACTION_BUTTON_SIZE,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  basicInfo: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  bioContainer: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  bioText: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },
  dot: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  dotActive: {
    opacity: 1,
    width: DOT_ACTIVE_WIDTH,
  },
  dotInactive: {
    opacity: 0.5,
  },
  dragHandle: {
    alignSelf: 'center',
    backgroundColor: colors.gray[300],
    borderRadius: borderRadius.full,
    height: DRAG_HANDLE_HEIGHT,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    width: DRAG_HANDLE_WIDTH,
  },
  headerIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  iconButton: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    padding: spacing.sm,
  },
  inCommonEmpty: {
    color: colors.gray[700],
    fontSize: typography.sizes.sm,
    paddingHorizontal: spacing.lg,
  },
  inCommonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  inCommonText: {
    color: colors.gray[700],
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  infoLabel: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  infoValue: {
    color: colors.gray[800],
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textAlign: 'right',
  },
  likeButton: {
    borderColor: colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaDivider: {
    color: colors.gray[400],
    fontSize: typography.sizes.sm,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    flex: 1,
    overflow: 'hidden',
  },
  name: {
    color: colors.gray[900],
    flexShrink: 1,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  paginationDots: {
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  passButton: {
    borderColor: colors.danger,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  photoContainer: {
    height: PHOTO_HEIGHT,
    marginBottom: spacing.lg,
    position: 'relative',
    width: SCREEN_WIDTH,
  },
  photoTapCenter: {
    height: '100%',
    left: '25%',
    position: 'absolute',
    top: 0,
    width: '50%',
  },
  photoTapLeft: {
    height: '100%',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '25%',
  },
  photoTapRight: {
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
    width: '25%',
  },
  readMore: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  reportCancel: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  reportCancelText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  reportOption: {
    alignItems: 'center',
    borderBottomColor: colors.gray[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  reportOptionText: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
  },
  reportSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  reportTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  scrollView: {
    flex: 1,
  },
  sheetBackdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  superLikeButton: {
    borderColor: colors.secondary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifiedIcon: {
    marginLeft: spacing.xs,
  },
})
