import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.faint}
        style={[styles.input, props.multiline && styles.textArea, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PillToggle<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.pills}>
      {options.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[styles.pill, value === option.value && styles.pillActive]}
          onPress={() => onChange(option.value)}
          activeOpacity={0.85}
        >
          <Text style={[styles.pillText, value === option.value && styles.pillTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primary, disabled && styles.primaryDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      <Text style={styles.primaryText}>{loading ? 'Working...' : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 7,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 96,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.orangeSoft,
    borderColor: colors.orange,
  },
  pillText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  pillTextActive: {
    color: colors.orangeDark,
  },
  primary: {
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    color: colors.greenDark,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

