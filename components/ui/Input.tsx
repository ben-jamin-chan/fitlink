import React, { useState } from 'react'

import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { KeyboardTypeOptions, TextInputProps } from 'react-native'

import { Ionicons } from '@expo/vector-icons'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface InputProps {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: TextInputProps['autoCapitalize']
  autoComplete?: TextInputProps['autoComplete']
  textContentType?: TextInputProps['textContentType']
  editable?: boolean
  multiline?: boolean
  numberOfLines?: number
  maxLength?: number
  onBlur?: () => void
}

export const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  editable = true,
  multiline = false,
  numberOfLines,
  maxLength,
  onBlur,
}: InputProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState(false)

  const hasError = error !== undefined && error !== ''
  const hasLabel = label !== undefined && label !== ''
  const isSecure = secureTextEntry && !isVisible
  const iconName = isVisible ? 'eye-off-outline' : 'eye-outline'

  const handleVisibilityPress = (): void => {
    setIsVisible((previousValue) => !previousValue)
  }

  return (
    <View style={styles.wrapper}>
      {hasLabel && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.container,
          hasError && styles.containerError,
          !editable && styles.containerDisabled,
          multiline && styles.containerMultiline,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onBlur={onBlur}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={handleVisibilityPress}
            activeOpacity={0.7}
          >
            <Ionicons name={iconName} size={20} color={colors.gray[500]} />
          </TouchableOpacity>
        )}
      </View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    height: 52,
    paddingHorizontal: spacing.md,
  },
  containerError: {
    borderColor: colors.danger,
  },
  containerDisabled: {
    backgroundColor: colors.gray[100],
    opacity: 0.7,
  },
  containerMultiline: {
    height: 'auto',
    minHeight: 52,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  },
  inputMultiline: {
    textAlignVertical: 'top',
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
})
