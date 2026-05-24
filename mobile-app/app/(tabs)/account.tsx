import React from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell, ChevronRight, Heart, LogOut, Settings, Sparkles, Wallet, Clock, Truck, ShieldCheck,
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
      {/* Premium Alibaba Orange Banner Header */}
      <View style={s.alibabaHeader}>
        <View style={s.alibabaBlob1} />
        <View style={s.alibabaBlob2} />
        
        <View style={s.profileRow}>
          <View style={s.avatarBig}>
            <Text style={s.avatarBigText}>{(user.fullName || 'U').slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={s.profileMeta}>
            <Text style={s.profileName}>{user.fullName}</Text>
            <Text style={s.profileEmail}>{user.email}</Text>
            <View style={s.profileBadgeRow}>
              <View style={s.roleBadgePremium}>
                <Text style={s.roleBadgePremiumText}>{roleLabel}</Text>
              </View>
              <View style={s.momoBadge}>
                <Text style={s.momoBadgeText}>MoMo Secured</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Dashboard Info Grid (Wallet & Wishlist) */}
      <View style={s.statsContainer}>
        {/* Wallet Overview Panel */}
        <TouchableOpacity style={s.quickWalletCard} onPress={() => router.push('/wallet' as any)} activeOpacity={0.88}>
          <View style={s.walletTextRow}>
            <Wallet color="#E05300" size={16} />
            <Text style={s.walletTitleText}>RMF WALLET</Text>
          </View>
          <Text style={s.walletBalanceVal}>Manage Funds</Text>
          <Text style={s.walletActionText}>MoMo payouts ›</Text>
        </TouchableOpacity>

        {/* Wishlist Overview Panel */}
        <TouchableOpacity style={s.quickWishlistCard} onPress={() => router.push('/wishlist' as any)} activeOpacity={0.88}>
          <View style={s.walletTextRow}>
            <Heart color="#DC2626" size={16} />
            <Text style={s.wishlistTitleText}>SAVED ITEMS</Text>
          </View>
          <Text style={s.wishlistVal}>Wishlist</Text>
          <Text style={s.walletActionText}>Saved products ›</Text>
        </TouchableOpacity>
      </View>

      {/* "My Orders" Status Dashboard */}
      <View style={s.orderStatusPanel}>
        <View style={s.panelTitleRow}>
          <Text style={s.panelTitle}>My Purchase Logs</Text>
          <TouchableOpacity onPress={() => router.push('/orders' as any)} activeOpacity={0.7}>
            <Text style={s.panelLinkText}>All Orders ›</Text>
          </TouchableOpacity>
        </View>
        
        <View style={s.orderStatusGrid}>
          <TouchableOpacity style={s.orderStatusItem} onPress={() => router.push('/orders' as any)} activeOpacity={0.8}>
            <Clock color="#E05300" size={22} />
            <Text style={s.orderStatusLabel}>Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.orderStatusItem} onPress={() => router.push('/orders' as any)} activeOpacity={0.8}>
            <Sparkles color="#E05300" size={22} />
            <Text style={s.orderStatusLabel}>Processing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.orderStatusItem} onPress={() => router.push('/orders' as any)} activeOpacity={0.8}>
            <Truck color="#E05300" size={22} />
            <Text style={s.orderStatusLabel}>In Transit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.orderStatusItem} onPress={() => router.push('/orders' as any)} activeOpacity={0.8}>
            <ShieldCheck color="#22c55e" size={22} />
            <Text style={s.orderStatusLabel}>Delivered</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Services List Panel */}
      <View style={s.servicesPanel}>
        <Text style={s.servicesTitle}>My Alibaba Services</Text>
        {rows.map((row, idx) => {
          const Icon = row.icon;
          return (
            <TouchableOpacity
              key={row.label}
              style={[s.serviceRow, idx < rows.length - 1 && s.serviceRowBorder]}
              onPress={() => router.push(row.route as any)}
              activeOpacity={0.7}
            >
              <View style={s.serviceIconWrap}>
                <Icon color="#E05300" size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.serviceLabel}>{row.label}</Text>
                <Text style={s.serviceSub}>{row.sub}</Text>
              </View>
              <ChevronRight color="#C4C4C4" size={14} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtnPremium} onPress={handleLogout} activeOpacity={0.85}>
        <LogOut color="#DC2626" size={18} />
        <Text style={s.logoutBtnPremiumText}>Log Out Account</Text>
      </TouchableOpacity>

      <Text style={s.version}>RMF Mobile · Alibaba Redesign v1.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
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

  // Authenticated layout
  content: { paddingBottom: 40 },
  alibabaHeader: {
    backgroundColor: ORANGE,
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  alibabaBlob1: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  alibabaBlob2: {
    position: 'absolute',
    left: -30,
    bottom: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  avatarBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarBigText: {
    color: ORANGE,
    fontSize: 24,
    fontWeight: '900',
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  profileEmail: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  roleBadgePremium: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgePremiumText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  momoBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 0.5,
    borderColor: '#FFD700',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  momoBadgeText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
  },

  // Stats Card Row
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -16,
    gap: 12,
    zIndex: 20,
  },
  quickWalletCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  quickWishlistCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  walletTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletTitleText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#E05300',
    letterSpacing: 0.5,
  },
  wishlistTitleText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  walletBalanceVal: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
    marginTop: 2,
  },
  wishlistVal: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
    marginTop: 2,
  },
  walletActionText: {
    fontSize: 9,
    color: MUTED,
    fontWeight: '600',
  },

  // Purchase Logs Status
  orderStatusPanel: {
    backgroundColor: CARD,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  panelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F2',
    paddingBottom: 10,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
  },
  panelLinkText: {
    fontSize: 11,
    color: ORANGE,
    fontWeight: '700',
  },
  orderStatusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  orderStatusItem: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  orderStatusLabel: {
    fontSize: 11,
    color: INK,
    fontWeight: '700',
  },

  // Services Panel
  servicesPanel: {
    backgroundColor: CARD,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F2',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  serviceRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F2',
  },
  serviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: ORANGE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: {
    color: INK,
    fontSize: 13,
    fontWeight: '800',
  },
  serviceSub: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  // Logout Premium
  logoutBtnPremium: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutBtnPremiumText: {
    color: RED,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  version: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
});
