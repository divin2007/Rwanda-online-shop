import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Field, PillToggle, PrimaryButton } from '../../src/components/FormControls';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Role } from '../../src/types';

type JoinRole = Exclude<Role, 'ADMIN'>;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState<JoinRole>('BUYER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false })
      .then(result => setCategories(asArray<CatalogCategory>(result).filter(category => category.isActive !== false).slice(0, 16)))
      .catch(() => setCategories([]));
  }, []);

  const toggleCategory = (id: string) => {
    setPreferredCategoryIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id].slice(0, 10));
  };

  const submit = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your password confirmation.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName,
        email: email.trim(),
        phone,
        password,
        role,
        preferredCategoryIds: role === 'BUYER' ? preferredCategoryIds : [],
      });
      Alert.alert('Account created', 'Please sign in to continue.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.logo}>RMF</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join as a buyer, seller, or rider. The next steps are pulled from the live RMF services after sign-in.</Text>

        <PillToggle
          value={role}
          onChange={setRole}
          options={[
            { value: 'BUYER', label: 'Buyer' },
            { value: 'SELLER', label: 'Seller' },
            { value: 'RIDER', label: 'Rider' },
          ]}
        />

        {role === 'BUYER' && categories.length ? (
          <View style={styles.preferencePanel}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceTitle}>Tune your feed</Text>
              <Text style={styles.preferenceCount}>{preferredCategoryIds.length} picked</Text>
            </View>
            <Text style={styles.preferenceBody}>Choose what you want RMF to recommend first. The app will keep learning as you browse and save products.</Text>
            <View style={styles.categoryWrap}>
              {categories.map(category => {
                const active = preferredCategoryIds.includes(category.id);
                return (
                  <TouchableOpacity key={category.id} style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => toggleCategory(category.id)} activeOpacity={0.85}>
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.form}>
          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XXXXXXXX" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimum 8 characters" />
          <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repeat password" />
          <PrimaryButton
            label="Create account"
            onPress={submit}
            loading={submitting}
            disabled={!fullName.trim() || !email.trim() || !phone.trim() || password.length < 8 || !confirmPassword}
          />
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
    padding: 20,
    paddingTop: 72,
    gap: 16,
  },
  logo: {
    color: colors.greenDark,
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
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
    paddingTop: 4,
  },
  preferencePanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: colors.orangeSoft,
    padding: 14,
    gap: 10,
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  preferenceTitle: {
    color: colors.orangeDark,
    fontSize: 15,
    fontWeight: '900',
  },
  preferenceCount: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  preferenceBody: {
    color: colors.greenDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: colors.card,
    paddingHorizontal: 11,
  },
  categoryChipActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  categoryChipText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  categoryChipTextActive: {
    color: colors.card,
  },
});
