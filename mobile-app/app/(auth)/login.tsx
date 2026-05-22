import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff, LockKeyhole, Mail, X } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';

const ORANGE = '#FF6B00';
const ORANGE_DARK = '#E05300';
const ORANGE_SOFT = '#FFF3EB';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const CARD = '#FFFFFF';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
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
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const forgotPassword = () => {
    Alert.prompt(
      'Reset password',
      'Enter your email address and we will send you a reset link.',
      async (inputEmail) => {
        if (!inputEmail?.trim()) return;
        setForgotLoading(true);
        try {
          await api.post('user', '/auth/forgot-password', { email: inputEmail.trim() });
          Alert.alert('Email sent', `A reset link was sent to ${inputEmail.trim()}.`);
        } catch (err) {
          Alert.alert('Failed', err instanceof Error ? err.message : 'Could not send reset email.');
        } finally {
          setForgotLoading(false);
        }
      },
      'plain-text', email, 'email-address',
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={CARD} />

      {/* Close / Back — goes back to main app without signing in */}
      <TouchableOpacity style={s.closeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
        <X color={MUTED} size={20} />
      </TouchableOpacity>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand mark */}
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>RMF</Text>
          </View>
          <Text style={s.tagline}>Rwanda's verified marketplace</Text>
        </View>

        <Text style={s.heading}>Welcome back</Text>
        <Text style={s.sub}>Sign in to shop, track orders, and manage your store.</Text>

        {/* Form card */}
        <View style={s.card}>
          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>Email address</Text>
            <View style={s.inputRow}>
              <Mail color={MUTED} size={16} style={{ marginRight: 8 }} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={s.input}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <LockKeyhole color={MUTED} size={16} style={{ marginRight: 8 }} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPw}
                autoComplete="password"
                style={[s.input, { flex: 1 }]}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {showPw ? <EyeOff color={MUTED} size={16} /> : <Eye color={MUTED} size={16} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot */}
          <TouchableOpacity onPress={forgotPassword} style={{ alignSelf: 'flex-end' }}>
            <Text style={s.forgotText}>{forgotLoading ? 'Sending...' : 'Forgot password?'}</Text>
          </TouchableOpacity>

          {/* Sign in button */}
          <TouchableOpacity
            style={[s.primaryBtn, (!email.trim() || !password) && s.primaryBtnDisabled]}
            onPress={submit}
            disabled={submitting || !email.trim() || !password}
            activeOpacity={0.88}
          >
            <Text style={s.primaryBtnText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Browse as guest */}
        <TouchableOpacity
          style={s.guestBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.88}
        >
          <Text style={s.guestBtnText}>Browse as guest</Text>
        </TouchableOpacity>

        {/* Register link */}
        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={s.footerLink}>Create one free</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Trust badges */}
        <View style={s.trust}>
          <Text style={s.trustText}>🔒 Encrypted · 🛡️ Escrow-backed · 🇷🇼 Made in Rwanda</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CARD },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    gap: 16,
    paddingBottom: 40,
  },
  brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: { color: CARD, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heading: { color: INK, fontSize: 30, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  sub: { color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  fieldWrap: { gap: 6 },
  label: { color: INK, fontSize: 13, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
  },
  input: { flex: 1, color: INK, fontSize: 14, fontWeight: '500', height: 50 },
  forgotText: { color: ORANGE_DARK, fontSize: 13, fontWeight: '700', marginTop: -4 },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  primaryBtnText: { color: CARD, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: LINE },
  dividerText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  guestBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: ORANGE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: { color: ORANGE_DARK, fontSize: 15, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: MUTED, fontSize: 14, fontWeight: '500' },
  footerLink: { color: ORANGE, fontSize: 14, fontWeight: '800' },
  trust: { alignItems: 'center', paddingTop: 4 },
  trustText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
});
