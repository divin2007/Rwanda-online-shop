import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, RefreshCcw, ShoppingBag } from 'lucide-react-native';
import { colors, shadow } from '../theme';

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function EmptyBlock({
  title, body, actionLabel, onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <ShoppingBag color={colors.primary} size={28} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <AlertCircle color={colors.danger} size={28} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Unable to load</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.85}>
          <RefreshCcw color="#fff" size={14} />
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.bg,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    margin: 16,
    padding: 28,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.divider,
    alignItems: 'center',
    gap: 8,
    ...shadow,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorIcon: {
    backgroundColor: '#FFF0F0',
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '400',
  },
  button: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
