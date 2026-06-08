import React from 'react';
import {
  Dimensions, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarChart3, Bike, Box, CheckCircle2, ChevronRight,
  ClipboardList, DollarSign, LogIn, MapPin, Package,
  QrCode, ReceiptText, ShieldCheck, Star, Store,
  Truck, UserCheck, Video, Wallet, Zap,
} from 'lucide-react-native';
import { AdminHub } from '../../src/components/AdminHub';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { useRemote } from '../../src/hooks/useRemote';

const { width: W } = Dimensions.get('window');

// ─── Reusable nav card ────────────────────────────────────────────────────────
function NavCard({
  icon, label, sub, route, badge, accent = colors.primary, iconBg,
}: {
  icon: React.ReactNode; label: string; sub?: string; route: string;
  badge?: string | number; accent?: string; iconBg?: string;
}) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={nc.card}
      onPress={() => router.push(route as any)}
      activeOpacity={0.82}
    >
      <View style={[nc.iconWrap, { backgroundColor: iconBg || `${accent}18` }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={nc.label}>{label}</Text>
        {sub && <Text style={nc.sub} numberOfLines={1}>{sub}</Text>}
      </View>
      {badge !== undefined && badge !== 0 ? (
        <View style={[nc.badge, { backgroundColor: accent }]}>
          <Text style={nc.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight color="#c0b8b0" size={16} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const nc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: '#17201a' },
  sub: { fontSize: 11, color: '#80756c', marginTop: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// ─── Metric pill ──────────────────────────────────────────────────────────────
function MetricPill({ label, value, color = colors.primary }: { label: string; value: string; color?: string }) {
  return (
    <View style={[mp.pill, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={mp.value}>{value}</Text>
      <Text style={mp.label}>{label}</Text>
    </View>
  );
}
const mp = StyleSheet.create({
  pill: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  value: { fontSize: 20, fontWeight: '800', color: '#17201a' },
  label: { fontSize: 10, color: '#80756c', fontWeight: '600', textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SELLER HUB
// ═══════════════════════════════════════════════════════════════════════════════
function SellerHub({ userId }: { userId: string }) {
  const { data, loading, refreshing, error, refresh } = useRemote(async () => {
    const [seller, orders, wallet, products] = await Promise.all([
      api.get<any>('seller', '/sellers/me').catch(() => null),
      api.get<any[]>('order', '/orders?limit=50').catch(() => []),
      api.get<any>('wallet', '/wallets/me').catch(() => null),
      api.get<any[]>('product', `/products?sellerId=${encodeURIComponent(userId)}&limit=5`).catch(() => []),
    ]);
    const allOrders = asArray<any>(orders);
    const pending = allOrders.filter((o: any) => ['placed','confirmed','preparing'].includes(o.status || '')).length;
    return { seller, orders: allOrders, pending, wallet, products: asArray(products) };
  }, [userId]);

  if (loading && !data) return <LoadingBlock label="Loading your seller hub..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const seller = data?.seller;
  const shopName = seller?.shopDetails?.name || seller?.stallName || 'My Store';
  const available = data?.wallet?.availableBalance ?? data?.wallet?.balance ?? 0;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroBlobA} /><View style={s.heroBlobB} />
        <View style={s.heroRow}>
          <View style={s.heroAvatar}>
            <Store color="#fff" size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{shopName}</Text>
            <View style={s.heroBadgeRow}>
              {seller?.isApproved
                ? <View style={s.approvedBadge}><CheckCircle2 color="#fff" size={11} /><Text style={s.badgeTxt}>Verified</Text></View>
                : <View style={[s.approvedBadge, { backgroundColor: '#d97706' }]}><Text style={s.badgeTxt}>Pending approval</Text></View>}
            </View>
          </View>
        </View>
        <View style={s.metricsRow}>
          <MetricPill label="Available" value={money(available)} color={colors.primary} />
          <MetricPill label="Orders" value={String(data?.orders.length || 0)} color="#2563eb" />
          <MetricPill label="Pending" value={String(data?.pending || 0)} color="#d97706" />
          <MetricPill label="Products" value={String(data?.products.length || 0)} color="#16a34a" />
        </View>
      </View>

      <Section title="Store" />
      <NavCard icon={<Package color={colors.primary} size={20} />} label="Products" sub="Manage your inventory" route="/seller/products" />
      <NavCard icon={<ReceiptText color="#2563eb" size={20} />} label="Orders" sub={`${data?.pending || 0} awaiting action`} route="/seller/orders" badge={data?.pending} accent="#2563eb" iconBg="#eff6ff" />
      <NavCard icon={<Zap color="#d97706" size={20} />} label="Promotions" sub="Discount offers & flash deals" route="/seller/promotions" accent="#d97706" iconBg="#fffbeb" />
      <NavCard icon={<Video color="#7c3aed" size={20} />} label="Videos" sub="Shop & product video ads" route="/seller/videos" accent="#7c3aed" iconBg="#f5f3ff" />

      <Section title="Performance" />
      <NavCard icon={<BarChart3 color="#16a34a" size={20} />} label="Analytics" sub="Sales charts & order stats" route="/seller/analytics" accent="#16a34a" iconBg="#f0fdf4" />
      <NavCard icon={<Wallet color={colors.primary} size={20} />} label="Earnings" sub={`${money(available)} available`} route="/seller/earnings" />
      <NavCard icon={<Star color="#f59e0b" size={20} />} label="Reviews" sub="Customer feedback" route="/seller/reviews" accent="#f59e0b" iconBg="#fffbeb" />

      <Section title="Tools" />
      <NavCard icon={<QrCode color="#0891b2" size={20} />} label="Stall QR Code" sub="Print & share with buyers" route="/seller/qr" accent="#0891b2" iconBg="#ecfeff" />
      {!seller && (
        <NavCard icon={<UserCheck color={colors.primary} size={20} />} label="Complete onboarding" sub="Finish your seller profile" route="/seller/onboarding" />
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDER HUB
// ═══════════════════════════════════════════════════════════════════════════════
function RiderHub({ userId }: { userId: string }) {
  const { data, loading, refreshing, error, refresh } = useRemote(async () => {
    const [active, available, wallet] = await Promise.all([
      api.get<any>('delivery', '/deliveries/active').catch(() => null),
      api.get<any[]>('delivery', '/deliveries/available').catch(() => []),
      api.get<any>('wallet', '/wallets/me').catch(() => null),
    ]);
    return { active, available: asArray(available), wallet };
  }, [userId]);

  if (loading && !data) return <LoadingBlock label="Loading rider hub..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const walletBalance = data?.wallet?.availableBalance ?? data?.wallet?.balance ?? 0;
  const availCount = data?.available?.length || 0;
  const hasActive = Boolean(data?.active);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Hero */}
      <View style={[s.hero, { backgroundColor: '#1e293b' }]}>
        <View style={s.heroBlobA} /><View style={s.heroBlobB} />
        <View style={s.heroRow}>
          <View style={[s.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Bike color="#fff" size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>Rider Dashboard</Text>
            {hasActive
              ? <View style={[s.approvedBadge, { backgroundColor: '#16a34a' }]}><Zap color="#fff" size={11} /><Text style={s.badgeTxt}>Active delivery</Text></View>
              : <View style={[s.approvedBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Text style={s.badgeTxt}>Awaiting job</Text></View>}
          </View>
        </View>
        <View style={s.metricsRow}>
          <MetricPill label="Wallet" value={money(walletBalance)} color={colors.primary} />
          <MetricPill label="Available" value={String(availCount)} color={availCount > 0 ? '#16a34a' : '#d97706'} />
          <MetricPill label="Status" value={hasActive ? 'On job' : 'Free'} color={hasActive ? '#16a34a' : '#80756c'} />
        </View>
      </View>

      {hasActive && (
        <View style={s.alertBanner}>
          <Truck color={colors.primary} size={18} />
          <Text style={s.alertText}>You have an active delivery in progress</Text>
          <TouchableOpacity onPress={() => {}} activeOpacity={0.8}>
            <Text style={s.alertLink}>View →</Text>
          </TouchableOpacity>
        </View>
      )}

      <Section title="Deliveries" />
      <NavCard icon={<Truck color={colors.primary} size={20} />} label="Deliveries" sub={`${availCount} job${availCount !== 1 ? 's' : ''} available`} route="/rider/deliveries" badge={availCount} />

      <Section title="Earnings" />
      <NavCard icon={<Wallet color="#16a34a" size={20} />} label="Earnings" sub={`${money(walletBalance)} available`} route="/rider/earnings" accent="#16a34a" iconBg="#f0fdf4" />

      <Section title="Profile" />
      <NavCard icon={<MapPin color="#0891b2" size={20} />} label="Location & status" sub="Update your availability" route="/rider/deliveries" accent="#0891b2" iconBg="#ecfeff" />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST
// ═══════════════════════════════════════════════════════════════════════════════
function GuestHub() {
  const router = useRouter();
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={[s.hero, { alignItems: 'center', paddingVertical: 40 }]}>
        <View style={s.heroBlobA} /><View style={s.heroBlobB} />
        <ShieldCheck color="#fff" size={40} />
        <Text style={[s.heroName, { textAlign: 'center', marginTop: 12 }]}>Join RMF as a Seller or Rider</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>
          Digitise your stall, manage inventory, accept orders — or earn money delivering packages across Rwanda.
        </Text>
      </View>
      <TouchableOpacity style={s.bigBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.85}>
        <LogIn color="#fff" size={18} />
        <Text style={s.bigBtnText}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.bigBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary }]} onPress={() => router.push('/(auth)/register')} activeOpacity={0.85}>
        <Text style={[s.bigBtnText, { color: colors.primary }]}>Create account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — routes to correct hub by role
// ═══════════════════════════════════════════════════════════════════════════════
export default function RoleHubScreen() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <GuestHub />;
  if (user.role === 'SELLER') return <SellerHub userId={user.id} />;
  if (user.role === 'RIDER') return <RiderHub userId={user.id} />;
  if (user.role === 'ADMIN') return <AdminHub />;

  // Buyer: quick links to seller/rider registration
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <View style={s.heroBlobA} /><View style={s.heroBlobB} />
        <Text style={s.heroName}>Hi, {user.fullName?.split(' ')[0] || 'there'} 👋</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>You're logged in as a buyer.</Text>
      </View>
      <Section title="Want to earn on RMF?" />
      <NavCard icon={<Store color={colors.primary} size={20} />} label="Become a seller" sub="Digitise your stall and start selling" route="/seller/onboarding" />
      <NavCard icon={<Bike color="#0891b2" size={20} />} label="Become a rider" sub="Deliver orders and earn per trip" route="/(auth)/rider-onboarding" accent="#0891b2" iconBg="#ecfeff" />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 14, gap: 10, paddingBottom: 48 },
  hero: {
    backgroundColor: colors.primary, borderRadius: 20, padding: 20, gap: 14, overflow: 'hidden', marginBottom: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  heroBlobA: { position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlobB: { position: 'absolute', left: -40, bottom: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroBadgeRow: { flexDirection: 'row', marginTop: 5 },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffedd5', borderRadius: 12, padding: 14 },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#17201a' },
  alertLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#80756c', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 2, marginTop: 4 },
  bigBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
