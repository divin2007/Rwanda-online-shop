import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff, X, ShoppingBag, Store, Bike } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { CatalogCategory, Role } from '../../src/types';

const ORANGE = '#FF6B00';
const ORANGE_DARK = '#E05300';
const ORANGE_SOFT = '#FFF3EB';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const CARD = '#FFFFFF';
const GREEN = '#15803D';

type JoinRole = Exclude<Role, 'ADMIN'>;

const ROLES: { value: JoinRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'BUYER', label: 'Buyer', icon: <ShoppingBag color={ORANGE} size={22} />, desc: 'Shop local markets with escrow protection' },
  { value: 'SELLER', label: 'Seller', icon: <Store color={ORANGE} size={22} />, desc: 'Open a verified stall and sell across Rwanda' },
  { value: 'RIDER', label: 'Rider', icon: <Bike color={ORANGE} size={22} />, desc: 'Deliver orders and earn daily income' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState<JoinRole>('BUYER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false })
      .then(r => setCategories(asArray<CatalogCategory>(r).filter(c => c.isActive !== false).slice(0, 18)))
      .catch(() => setCategories([]));
  }, []);

  const toggleCategory = (id: string) => {
    setPreferredCategoryIds(cur =>
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id].slice(0, 10),
    );
  };

  const isValid = fullName.trim() && email.trim() && phone.trim() && password.length >= 8 && confirmPassword.length >= 1;

  const submit = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Passwords don\'t match', 'Please check your confirmation password.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone,
        password,
        role,
        preferredCategoryIds: role === 'BUYER' ? preferredCategoryIds : [],
      });
      if (role === 'RIDER') {
        // Riders must complete document onboarding before accessing the app
        router.replace('/(auth)/rider-onboarding');
      } else {
        Alert.alert('Account created!', 'Your RMF account is ready. Sign in to get started.', [
          { text: 'Sign in now', onPress: () => router.replace('/(auth)/login') },
        ]);
      }
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Please try again.');

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={CARD} />

      {/* Close / Back — go to main app without registering */}
      <TouchableOpacity style={s.closeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
        <X color={MUTED} size={20} />
      </TouchableOpacity>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>RMF</Text>
          </View>
        </View>
        <Text style={s.heading}>Create account</Text>
        <Text style={s.sub}>Join thousands of buyers, sellers, and riders on Rwanda's verified marketplace.</Text>

        {/* Role selector */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>I want to join as</Text>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[s.roleCard, role === r.value && s.roleCardActive]}
              onPress={() => setRole(r.value)}
              activeOpacity={0.85}
            >
              <View style={s.roleIconWrap}>{r.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={[s.roleLabel, role === r.value && s.roleLabelActive]}>{r.label}</Text>
                <Text style={s.roleDesc}>{r.desc}</Text>
              </View>
              <View style={[s.roleRadio, role === r.value && s.roleRadioActive]}>
                {role === r.value && <View style={s.roleRadioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personal info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your details</Text>
          <View style={s.card}>
            <View style={s.fieldWrap}>
              <Text style={s.label}>Full name</Text>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Jean-Paul Kamana" placeholderTextColor="#9CA3AF" style={s.input} returnKeyType="next" />
            </View>
            <View style={[s.fieldWrap, s.dividerTop]}>
              <Text style={s.label}>Email address</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" style={s.input} returnKeyType="next" />
            </View>
            <View style={[s.fieldWrap, s.dividerTop]}>
              <Text style={s.label}>Phone number</Text>
              <TextInput value={phone} onChangeText={setPhone} placeholder="07XXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" style={s.input} returnKeyType="next" />
            </View>
            <View style={[s.fieldWrap, s.dividerTop]}>
              <Text style={s.label}>Password <Text style={{ color: MUTED }}>(min 8 chars)</Text></Text>
              <View style={s.pwRow}>
                <TextInput value={password} onChangeText={setPassword} placeholder="Create a strong password" placeholderTextColor="#9CA3AF" secureTextEntry={!showPw} style={[s.input, { flex: 1 }]} returnKeyType="next" />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  {showPw ? <EyeOff color={MUTED} size={16} /> : <Eye color={MUTED} size={16} />}
                </TouchableOpacity>
              </View>
            </View>
            <View style={[s.fieldWrap, s.dividerTop]}>
              <Text style={s.label}>Confirm password</Text>
              <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" placeholderTextColor="#9CA3AF" secureTextEntry style={s.input} returnKeyType="done" onSubmitEditing={submit} />
            </View>
          </View>
        </View>

        {/* Category preferences (buyers only) */}
        {role === 'BUYER' && categories.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>What do you like to shop? <Text style={{ color: MUTED, fontWeight: '500' }}>({preferredCategoryIds.length} picked)</Text></Text>
            <Text style={s.sectionSub}>RMF will show you these first. You can change anytime.</Text>
            <View style={s.chips}>
              {categories.map(cat => {
                const active = preferredCategoryIds.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleCategory(cat.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s.primaryBtn, !isValid && s.primaryBtnDisabled]}
          onPress={submit}
          disabled={submitting || !isValid}
          activeOpacity={0.88}
        >
          <Text style={s.primaryBtnText}>{submitting ? 'Creating account…' : 'Create my account'}</Text>
        </TouchableOpacity>

        {/* Guest option */}
        <TouchableOpacity style={s.guestBtn} onPress={() => router.replace('/')} activeOpacity={0.88}>
          <Text style={s.guestBtnText}>Browse as guest instead</Text>
        </TouchableOpacity>

        {/* Login link */}
        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={s.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scroll: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 100 : 70,
    gap: 16,
    paddingBottom: 40,
  },
  brand: { alignItems: 'center', marginBottom: 4 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  logoText: { color: CARD, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  heading: { color: INK, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  sub: { color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  section: { gap: 10 },
  sectionTitle: { color: INK, fontSize: 15, fontWeight: '800' },
  sectionSub: { color: MUTED, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: -4 },
  // Role cards
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: CARD,
  },
  roleCardActive: { borderColor: ORANGE, backgroundColor: ORANGE_SOFT },
  roleIconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  roleLabel: { color: INK, fontSize: 15, fontWeight: '800' },
  roleLabelActive: { color: ORANGE_DARK },
  roleDesc: { color: MUTED, fontSize: 12, fontWeight: '500', marginTop: 1 },
  roleRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  roleRadioActive: { borderColor: ORANGE },
  roleRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  // Form card
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dividerTop: { borderTopWidth: 1, borderTopColor: LINE },
  fieldWrap: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  label: { color: INK, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  input: { color: INK, fontSize: 15, fontWeight: '500', height: 28, paddingVertical: 0 },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Category chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: CARD,
    justifyContent: 'center',
  },
  chipActive: { borderColor: ORANGE, backgroundColor: ORANGE_SOFT },
  chipText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: ORANGE_DARK },
  // Buttons
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  primaryBtnText: { color: CARD, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  guestBtn: {
    height: 50,
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
});
