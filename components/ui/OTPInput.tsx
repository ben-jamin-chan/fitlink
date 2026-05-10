import React, { useRef, useState } from 'react'

import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputChangeEventData,
  TextInputKeyPressEventData,
  View,
} from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const OTP_LENGTH = 6

interface OTPInputProps {
  onComplete: (otp: string) => void
  onReset?: () => void
  error?: boolean
  disabled?: boolean
}

export const OTPInput = ({
  onComplete,
  onReset,
  error = false,
  disabled = false,
}: OTPInputProps): React.JSX.Element => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null))

  const focusBox = (index: number): void => {
    if (index >= 0 && index < OTP_LENGTH) {
      inputRefs.current[index]?.focus()
    }
  }

  const handleChange = (
    event: NativeSyntheticEvent<TextInputChangeEventData>,
    index: number
  ): void => {
    const text = event.nativeEvent.text

    if (text.length > 1) {
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
      const newDigits = Array<string>(OTP_LENGTH).fill('')

      for (let i = 0; i < cleaned.length; i += 1) {
        newDigits[i] = cleaned[i]
      }

      setDigits(newDigits)
      focusBox(Math.min(cleaned.length - 1, OTP_LENGTH - 1))

      if (cleaned.length === OTP_LENGTH) {
        onComplete(cleaned)
      } else {
        onReset?.()
      }

      return
    }

    const digit = text.replace(/\D/g, '')

    if (digit.length === 0) {
      return
    }

    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (index < OTP_LENGTH - 1) {
      focusBox(index + 1)
    }

    if (newDigits.every((value) => value !== '')) {
      onComplete(newDigits.join(''))
    } else {
      onReset?.()
    }
  }

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ): void => {
    if (event.nativeEvent.key !== 'Backspace') {
      return
    }

    const newDigits = [...digits]

    if (newDigits[index] !== '') {
      newDigits[index] = ''
      setDigits(newDigits)
      onReset?.()
      return
    }

    if (index > 0) {
      newDigits[index - 1] = ''
      setDigits(newDigits)
      focusBox(index - 1)
      onReset?.()
    }
  }

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => (
        <TextInput
          key={`otp-${index}`}
          ref={(ref) => {
            inputRefs.current[index] = ref
          }}
          style={[
            styles.box,
            digit !== '' && styles.boxFilled,
            error && styles.boxError,
            disabled && styles.boxDisabled,
          ]}
          value={digit}
          onChange={(event) => handleChange(event, index)}
          onKeyPress={(event) => handleKeyPress(event, index)}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          editable={!disabled}
          textAlign="center"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    backgroundColor: colors.surface,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  boxDisabled: {
    opacity: 0.6,
  },
})
