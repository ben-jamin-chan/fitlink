import React from 'react'

import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { colors, spacing } from '@/constants/theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const MIN_SCALE = 1
const MAX_SCALE = 4
const RESET_SCALE_THRESHOLD = 1.05
const DISMISS_THRESHOLD = spacing.xxxl + spacing.xl + spacing.xs
const SPRING_CONFIG = { damping: 15, stiffness: 150 }

interface PhotoViewerProps {
  visible: boolean
  photoUri: string
  onClose: () => void
}

export const PhotoViewer = ({
  visible,
  photoUri,
  onClose,
}: PhotoViewerProps): React.JSX.Element => {
  const scale = useSharedValue(MIN_SCALE)
  const savedScale = useSharedValue(MIN_SCALE)
  const translateY = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const resetTransforms = (): void => {
    scale.value = MIN_SCALE
    savedScale.value = MIN_SCALE
    translateY.value = 0
    savedTranslateY.value = 0
  }

  const handleClose = (): void => {
    resetTransforms()
    onClose()
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(
        MIN_SCALE,
        Math.min(savedScale.value * event.scale, MAX_SCALE),
      )
    })
    .onEnd(() => {
      savedScale.value = scale.value

      if (scale.value < RESET_SCALE_THRESHOLD) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG)
        savedScale.value = MIN_SCALE
      }
    })

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (savedScale.value <= MIN_SCALE && event.translationY > 0) {
        translateY.value = savedTranslateY.value + event.translationY
      }
    })
    .onEnd((event) => {
      if (
        savedScale.value <= MIN_SCALE &&
        event.translationY > DISMISS_THRESHOLD
      ) {
        runOnJS(handleClose)()
        return
      }

      translateY.value = withSpring(0, SPRING_CONFIG)
      savedTranslateY.value = 0
    })

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.8}
        >
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
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: 'center',
  },
  closeButton: {
    padding: spacing.sm,
    position: 'absolute',
    right: spacing.lg,
    top: spacing.xl + spacing.md,
    zIndex: 10,
  },
  image: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
  },
  imageWrapper: {
    alignItems: 'center',
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    width: SCREEN_WIDTH,
  },
})
