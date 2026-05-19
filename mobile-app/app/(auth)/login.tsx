import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LockKeyhole, Mail } from 'lucide-react-native';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'SELLER') router.replace('/seller');
      else if (user.role === 'RIDER') router.replace('/rider/deliveries');
      else {
        const prefs = await api.get<Record<string, any>>('user', '/users/preferences/discovery').catch(() => null);
        router.replace(prefs?.onboardingCompleted ? '/' : '/preferences');
      }
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.logo}>RMF</Text>
          <Text style={styles.badge}>Verified market access</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Use the same account you use on the RMF web platform.</Text>

          <View style={styles.form}>
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="Your password"
            />
            <PrimaryButton
              label="Sign in"
              onPress={submit}
              loading={submitting}
              disabled={!email.trim() || password.length < 1}
            />
          </View>

          <View style={styles.links}>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Create account</Text>
              </TouchableOpacity>
            </Link>
            <View style={styles.iconRow}>
              <Mail color={colors.orange} size={14} />
              <LockKeyhole color={colors.orange} size={14} />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    minHeight: '100%',
    justifyContent: 'center',
    padding: 20,
    gap: 20,
  },
  brand: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    color: colors.greenDark,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  badge: {
    color: colors.orangeDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 22,
    gap: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  form: {
    gap: 14,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    color: colors.orangeDark,
    fontSize: 13,
    fontWeight: '900',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
