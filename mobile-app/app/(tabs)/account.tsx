import React from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell, ChevronRight, Heart, LogOut, Settings, Sparkles, Wallet,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';

const ORANGE = '#FF6B00';
const ORANGE_DARK = '#E05300';
const ORANGE_SOFT = '#FFF3EB';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const CARD = '#FFFFFF';
const RED = '#DC2626';

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // ── Guest view ───────────────────────────────────────────────────────────────
  if (!isAuthenticated || !user) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.guestContent} showsVerticalScrollIndicator={false}>
        <View style={s.guestCard}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>RMF</Text>
          </View>
          <Text style={s.guestTitle}>Your account awaits</Text>
          <Text style={s.guestBody}>
            Sign in to track orders, manage your wishlist, check your wallet balance, and get personalised recommendations.
          </Text>

          <TouchableOpacity style={s.signInBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.88}>
            <Text style={s.signInBtnText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.createBtn} onPress={() => router.push('/(auth)/register')} activeOpacity={0.88}>
            <Text style={s.createBtnText}>Create account — it's free</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={s.skipText}>Continue browsing as guest →</Text>
          </TouchableOpacity>
        </View>

        <View style={s.trustRow}>
          <Text style={s.trustText}>🔒 Encrypted</Text>
          <Text style={s.trustText}>🛡️ Escrow-backed</Text>
          <Text style={s.trustText}>🇷🇼 Made in Rwanda</Text>
        </View>
      </ScrollView>
    );
  }

  // ── Authenticated view ───────────────────────────────────────────────────────
  const roleLabel = user.role === 'SELLER' ? 'Verified Seller' : user.role === 'RIDER' ? 'Delivery Rider' : user.role === 'ADMIN' ? 'Admin' : 'Buyer';

  const rows = [
    { label: 'Notifications', sub: 'Order alerts & updates', icon: Bell, route: '/notifications' },
    { label: 'Wallet', sub: 'Balance & transactions', icon: Wallet, route: '/wallet' },
    { label: 'Wishlist', sub: 'Saved products', icon: Heart, route: '/wishlist' },
    { label: 'Recommendations', sub: 'Tune your feed', icon: Sparkles, route: '/preferences' },
    { label: 'Settings', sub: 'App & account settings', icon: Settings, route: '/settings' },
  ];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Hero card */}
      <View style={s.hero}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(user.fullName || 'U').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heroName}>{user.fullName}</Text>
          <Text style={s.heroEmail}>{user.email}</Text>
        </View>
        <View style={s.roleBadge}>
          <Text style={s.roleBadgeText}>{roleLabel}</Text>
        </View>
      </View>

      {/* Menu rows */}
      <View style={s.panel}>
        {rows.map((row, idx) => {
          const Icon = row.icon;
          return (
            <TouchableOpacity
              key={row.label}
              style={[s.row, idx < rows.length - 1 && s.rowBorder]}
              onPress={() => router.push(row.route as any)}
              activeOpacity={0.7}
            >
              <View style={s.rowIcon}>
                <Icon color={ORANGE} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowSub}>{row.sub}</Text>
              </View>
              <ChevronRight color="#C4C4C4" size={16} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <LogOut color={RED} size={18} />
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={s.version}>RMF Mobile · v1.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  // Guest
  guestContent: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 20 },
  guestCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 4,
  },
  logoText: { color: CARD, fontSize: 22, fontWeight: '900' },
  guestTitle: { color: INK, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  guestBody: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '500' },
  signInBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 6,
  },
  signInBtnText: { color: CARD, fontSize: 15, fontWeight: '900' },
  createBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: ORANGE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: ORANGE_DARK, fontSize: 15, fontWeight: '800' },
  skipText: { color: MUTED, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', marginTop: 4 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, flexWrap: 'wrap' },
  trustText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
  // Authenticated
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: CARD, fontSize: 20, fontWeight: '900' },
  heroName: { color: INK, fontSize: 17, fontWeight: '900' },
  heroEmail: { color: MUTED, fontSize: 12, fontWeight: '500' },
  roleBadge: {
    backgroundColor: ORANGE_SOFT,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleBadgeText: { color: ORANGE_DARK, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  panel: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LINE },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ORANGE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { color: INK, fontSize: 15, fontWeight: '700' },
  rowSub: { color: MUTED, fontSize: 12, fontWeight: '500', marginTop: 1 },
  logoutBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: { color: RED, fontSize: 15, fontWeight: '800' },
  version: { color: '#D1D5DB', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
