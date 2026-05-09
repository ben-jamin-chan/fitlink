import React, { useState } from 'react'

import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface CountryCode {
  code: string
  flag: string
  name: string
}

interface PhoneInputProps {
  value: string
  onChangeText: (text: string) => void
  onCountryCodeChange: (code: string) => void
  selectedCountryCode: string
  error?: string
  placeholder?: string
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
]

export const PhoneInput = ({
  value,
  onChangeText,
  onCountryCodeChange,
  selectedCountryCode,
  error,
  placeholder,
}: PhoneInputProps): React.JSX.Element => {
  const [modalVisible, setModalVisible] = useState(false)

  const selectedCountry =
    COUNTRY_CODES.find((country) => country.code === selectedCountryCode) ??
    COUNTRY_CODES[0]

  const handleSelect = (country: CountryCode): void => {
    onCountryCodeChange(country.code)
    setModalVisible(false)
  }

  const closeModal = (): void => {
    setModalVisible(false)
  }

  const openModal = (): void => {
    setModalVisible(true)
  }

  return (
    <View>
      <View style={[styles.container, error ? styles.containerError : null]}>
        <TouchableOpacity
          style={styles.picker}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.code}>{selectedCountry.code}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
        />
      </View>
      {error !== undefined && error !== '' && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    height: 52,
    overflow: 'hidden',
  },
  containerError: {
    borderColor: colors.danger,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  flag: {
    fontSize: typography.sizes.lg,
  },
  code: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
    fontWeight: typography.weights.medium,
  },
  chevron: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.gray[300],
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '60%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowFlag: {
    fontSize: typography.sizes.xl,
  },
  rowName: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  },
  rowCode: {
    fontSize: typography.sizes.md,
    color: colors.gray[500],
    fontWeight: typography.weights.medium,
  },
})
