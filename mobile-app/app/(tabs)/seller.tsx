import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bike, Box, ClipboardList, Heart, MapPin, ReceiptText, Settings, ShieldCheck, Store, Wallet, Activity, Truck, CheckCircle2, TrendingUp, Clock, ArrowRight, Package } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminHub } from '../../src/components/AdminHub';
import { MapPreview, coordinatesFromAny } from '../../src/components/MapPreview';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Delivery, Order, Product, SellerProfile, Wallet as WalletType } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

const { width: SCREEN_W } = Dimensions.get('window');

type HubPayload = {
  seller: SellerProfile | null;
  products: Product[];
  orders: Order[];
  wallet: WalletType | null;
  activeDelivery: Delivery | null;
  availableDeliveries: Delivery[];
  deliveryHistory: Delivery[];
};

const emptyPayload: HubPayload = {
  seller: null,
  products: [],
  orders: [],
  wallet: null,
  activeDelivery: null,
  availableDeliveries: [],
  deliveryHistory: [],
};

const loadHub = async (enabled: boolean, role?: string, userId?: string): Promise<HubPayload> => {
  if (!enabled) return emptyPayload;

  if (role === 'ADMIN') {
    return emptyPayload;
  }

  if (role === 'SELLER') {
    const seller = await api.get<SellerProfile | null>('seller', '/sellers/me').catch(() => null);
    const [products, orders, wallet] = await Promise.all([
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(userId || '')}`).catch(() => []),
      api.get<Order[]>('order', '/orders').catch(() => []),
      api.get<WalletType>('wallet', '/wallets/me').catch(() => null),
    ]);
    return { ...emptyPayload, seller, products: asArray(products), orders: asArray(orders), wallet };
  }

  if (role === 'RIDER') {
    const [activeDelivery, availableDeliveries, deliveryHistory, wallet] = await Promise.all([
      api.get<Delivery | null>('delivery', '/deliveries/active').catch(() => null),
      api.get<Delivery[]>('delivery', '/deliveries/available').catch(() => []),
      api.get<Delivery[]>('delivery', '/deliveries/history').catch(() => []),
      api.get<WalletType>('wallet', '/wallets/me').catch(() => null),
    ]);
    return {
      ...emptyPayload,
      activeDelivery,
      availableDeliveries: asArray(availableDeliveries),
      deliveryHistory: asArray(deliveryHistory),
      wallet,
    };
  }

  const [orders, wallet] = await Promise.all([
    api.get<Order[]>('order', '/orders').catch(() => []),
    api.get<WalletType>('wallet', '/wallets/me').catch(() => null),
  ]);
  return { ...emptyPayload, orders: asArray(orders), wallet };
};

export default function RoleHubScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh } = useRemote(
    () => loadHub(isAuthenticated, user?.role, user?.id),
    [isAuthenticated, user?.role, user?.id],
  );

  if (!isAuthenticated) {
    return <EmptyBlock title="Sign in for your dashboard" body="Your RMF role dashboard appears after login." actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />;
  }
  if (loading && !data) return <LoadingBlock label="Loading your premium dashboard..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  if (user?.role === 'ADMIN') {
    return <AdminHub />;
  }
  if (user?.role === 'RIDER') {
    return <RiderHub data={data || emptyPayload} refreshing={refreshing} refresh={refresh} />;
  }
  if (user?.role === 'SELLER') {
    return <SellerHub data={data || emptyPayload} refreshing={refreshing} refresh={refresh} />;
  }
  return <BuyerHub data={data || emptyPayload} refreshing={refreshing} refresh={refresh} />;
}

function BuyerHub({ data, refreshing, refresh }: { data: HubPayload; refreshing: boolean; refresh: () => void }) {
  const router = useRouter();
  const activeOrder = data.orders.find(order => !['delivered', 'cancelled', 'resolved'].includes(String(order.status || '').toLowerCase()));
  
  return (
    <HubScroll refreshing={refreshing} refresh={refresh}>
      <View style={[styles.heroCard, { backgroundColor: '#1b1c1c' }]}>
        <View style={styles.heroTopRow}>
          <ShieldCheck color="#a63f00" size={32} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeTxt}>BUYER</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: '#ffffff' }]}>Welcome back,</Text>
        <Text style={[styles.subtitle, { color: '#8e9e95' }]}>Orders, tracking, and wallet overview.</Text>
      </View>

      <View style={styles.metricsGrid}>
        <PremiumMetric icon={<ReceiptText color="#a63f00" size={20} />} value={data.orders.length} label="Active Orders" />
        <PremiumMetric icon={<Wallet color="#a63f00" size={20} />} value={money(data.wallet?.availableBalance ?? data.wallet?.balance)} label="Available Balance" />
      </View>

      <Text style={styles.sectionHeading}>Quick Actions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
        <PremiumAction label="Markets" onPress={() => router.push('/markets' as any)} icon={<Store color="#1b1c1c" size={18} />} />
        <PremiumAction label="Orders" onPress={() => router.push('/orders' as any)} icon={<Package color="#1b1c1c" size={18} />} />
        <PremiumAction label="Wishlist" onPress={() => router.push('/wishlist' as any)} icon={<Heart color="#1b1c1c" size={18} />} />
        <PremiumAction label="Settings" onPress={() => router.push('/settings' as any)} icon={<Settings color="#1b1c1c" size={18} />} />
      </ScrollView>

      {activeOrder?.delivery ? (
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.sectionHeading}>Live Tracking</Text>
            <View style={styles.livePulse} />
          </View>
          <MapPreview
            title={`Order #${shortId(activeOrder.orderNumber || activeOrder._id)}`}
            points={[
              { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(activeOrder.delivery?.pickup || activeOrder.delivery?.pickupLocation) },
              { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(activeOrder.delivery?.dropoff || activeOrder.delivery?.dropoffLocation || activeOrder.delivery?.destination) },
              { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(activeOrder.delivery?.currentLocation || activeOrder.delivery?.riderLocation) },
            ]}
          />
          <TouchableOpacity style={styles.fullWidthBtn} onPress={() => router.push(`/orders/${activeOrder._id}` as any)}>
            <Text style={styles.fullWidthBtnTxt}>Open Full Tracking</Text>
            <ArrowRight color="#ffffff" size={16} />
          </TouchableOpacity>
        </View>
      ) : null}
      
      <RecentOrders orders={data.orders} />
    </HubScroll>
  );
}

function SellerHub({ data, refreshing, refresh }: { data: HubPayload; refreshing: boolean; refresh: () => void }) {
  const router = useRouter();
  const seller = data.seller;

  if (!seller) {
    return <EmptyBlock title="Complete seller onboarding" body="Your seller profile has not been created yet." actionLabel="Start onboarding" onAction={() => router.push('/seller/onboarding' as any)} />;
  }

  return (
    <HubScroll refreshing={refreshing} refresh={refresh}>
      <View style={[styles.heroCard, { backgroundColor: '#a63f00' }]}>
        <View style={styles.heroTopRow}>
          <Store color="#ffffff" size={32} />
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <BadgeCheck color={seller.isApproved ? '#22c55e' : '#fbbf24'} size={14} style={{ marginRight: 4 }} />
            <Text style={[styles.heroBadgeTxt, { color: '#ffffff' }]}>
              {seller.isApproved ? 'VERIFIED' : 'PENDING'}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: '#ffffff' }]}>{seller.shopDetails?.name || seller.stallName}</Text>
        <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>Seller Performance Overview</Text>
      </View>

      <View style={styles.metricsGrid}>
        <PremiumMetric icon={<Wallet color="#a63f00" size={20} />} value={money(data.wallet?.balance || data.wallet?.availableBalance)} label="Total Earnings" />
        <PremiumMetric icon={<Box color="#a63f00" size={20} />} value={data.products.length} label="Active Products" />
        <PremiumMetric icon={<TrendingUp color="#a63f00" size={20} />} value={data.orders.length} label="Total Orders" />
      </View>

      <Text style={styles.sectionHeading}>Business Management</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
        <PremiumAction label="Inventory" onPress={() => router.push('/seller/products' as any)} icon={<Box color="#1b1c1c" size={18} />} />
        <PremiumAction label="Promotions" onPress={() => router.push('/seller/promotions' as any)} icon={<TrendingUp color="#1b1c1c" size={18} />} />
        <PremiumAction label="Video Ads" onPress={() => router.push('/seller/videos' as any)} icon={<Activity color="#1b1c1c" size={18} />} />
        <PremiumAction label="Payouts" onPress={() => router.push('/wallet' as any)} icon={<Wallet color="#1b1c1c" size={18} />} />
        <PremiumAction label="Settings" onPress={() => router.push('/seller/onboarding' as any)} icon={<Settings color="#1b1c1c" size={18} />} />
      </ScrollView>

      <RecentOrders orders={data.orders} seller />
    </HubScroll>
  );
}

function RiderHub({ data, refreshing, refresh }: { data: HubPayload; refreshing: boolean; refresh: () => void }) {
  const router = useRouter();
  const active = data.activeDelivery;

  return (
    <HubScroll refreshing={refreshing} refresh={refresh}>
      <View style={[styles.heroCard, { backgroundColor: '#1b1c1c' }]}>
        <View style={styles.heroTopRow}>
          <Bike color="#a63f00" size={32} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeTxt}>FLEET RIDER</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: '#ffffff' }]}>Ready to deliver?</Text>
        <Text style={[styles.subtitle, { color: '#8e9e95' }]}>Track earnings, active routes, and new requests.</Text>
      </View>

      <View style={styles.metricsGrid}>
        <PremiumMetric icon={<MapPin color="#a63f00" size={20} />} value={active ? 1 : 0} label="Active Route" />
        <PremiumMetric icon={<Truck color="#a63f00" size={20} />} value={data.availableDeliveries.length} label="Job Requests" />
        <PremiumMetric icon={<Wallet color="#a63f00" size={20} />} value={money(data.wallet?.availableBalance ?? data.wallet?.balance)} label="Total Earnings" />
      </View>

      <Text style={styles.sectionHeading}>Fleet Tools</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
        <PremiumAction label="Available Jobs" onPress={() => router.push('/rider/deliveries' as any)} icon={<ClipboardList color="#1b1c1c" size={18} />} />
        <PremiumAction label="Earnings Payout" onPress={() => router.push('/wallet' as any)} icon={<Wallet color="#1b1c1c" size={18} />} />
      </ScrollView>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.sectionHeading}>Live Mission Map</Text>
          {active && <View style={styles.livePulse} />}
        </View>
        <MapPreview
          title={active ? `Mission #${shortId(active._id)}` : 'Standby Area'}
          points={[
            { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(active?.pickup) },
            { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(active?.dropoff) },
            { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(active?.currentLocation) },
          ]}
        />
        {active ? (
          <View style={styles.deliverySummaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle}>Mission Active</Text>
              <Text style={styles.summaryStatus}>{String(active.status || 'pending').toUpperCase()}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryFeeVal}>{money(active.earnings || active.fee)}</Text>
              <Text style={styles.summaryFeeLbl}>EARNINGS</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyStateCard}>
            <Clock color="#8e9e95" size={24} />
            <Text style={styles.muted}>Awaiting dispatch assignment.</Text>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionHeading}>Dispatch Requests</Text>
        {data.availableDeliveries.length ? data.availableDeliveries.slice(0, 5).map(delivery => (
          <TouchableOpacity key={delivery._id} style={styles.jobRow} onPress={() => router.push('/rider/deliveries' as any)}>
            <View style={styles.jobIconWrap}>
              <MapPin color="#a63f00" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>Request #{shortId(delivery._id)}</Text>
              <Text style={styles.jobMeta}>{formatDateTime(delivery.createdAt)}</Text>
            </View>
            <View style={styles.jobRight}>
              <Text style={styles.jobFee}>{money(delivery.earnings || delivery.fee)}</Text>
              <ArrowRight color="#a63f00" size={16} />
            </View>
          </TouchableOpacity>
        )) : (
          <View style={styles.emptyStateCard}>
            <CheckCircle2 color="#8e9e95" size={24} />
            <Text style={styles.muted}>No open jobs right now.</Text>
          </View>
        )}
      </View>
    </HubScroll>
  );
}

function RecentOrders({ orders, seller }: { orders: Order[], seller?: boolean }) {
  const router = useRouter();
  if (!orders.length) return null;
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionHeading}>Recent Transactions</Text>
      {orders.slice(0, 4).map(order => (
        <TouchableOpacity key={order._id} style={styles.orderCardRow} onPress={() => router.push(`/orders/${order._id}` as any)}>
          <View style={styles.jobIconWrap}>
            <Package color="#a63f00" size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderCardTitle}>Order #{shortId(order.orderNumber || order._id)}</Text>
            <Text style={styles.orderCardStatus}>{String(order.status).toUpperCase()}</Text>
          </View>
          <View style={styles.jobRight}>
            <Text style={styles.orderCardTotal}>{money(order.financials?.totalAmount)}</Text>
            <Text style={styles.jobMeta}>{formatDateTime(order.createdAt).split(',')[0]}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function HubScroll({ children, refreshing, refresh }: any) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#a63f00" />}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function PremiumMetric({ icon, value, label }: any) {
  return (
    <View style={styles.premiumMetricCard}>
      <View style={styles.metricIconWrap}>{icon}</View>
      <Text style={styles.metricValTxt} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLblTxt}>{label}</Text>
    </View>
  );
}

function PremiumAction({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.premiumActionBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.actionIconWrap}>{icon}</View>
      <Text style={styles.actionLabelTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8f5' },
  content: { paddingHorizontal: 16, paddingBottom: 100, gap: 24 },
  heroCard: { 
    padding: 24, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 16, 
    elevation: 8 
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroBadge: { backgroundColor: 'rgba(166, 63, 0, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  heroBadgeTxt: { color: '#a63f00', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '500', lineHeight: 20 },
  metricsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  premiumMetricCard: { 
    flex: 1, 
    minWidth: '45%', 
    backgroundColor: '#ffffff', 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#f1eee9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1
  },
  metricIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValTxt: { fontSize: 18, fontWeight: '900', color: '#1b1c1c', marginBottom: 2 },
  metricLblTxt: { fontSize: 11, fontWeight: '700', color: '#8e9e95' },
  sectionHeading: { fontSize: 18, fontWeight: '900', color: '#1b1c1c', letterSpacing: 0.5 },
  actionsScroll: { gap: 12, paddingRight: 24, paddingVertical: 4 },
  premiumActionBtn: { 
    backgroundColor: '#ffffff', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 100, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  actionIconWrap: { backgroundColor: '#f1eee9', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabelTxt: { fontSize: 13, fontWeight: '800', color: '#1b1c1c' },
  panel: { backgroundColor: '#ffffff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1eee9', gap: 16 },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }, // Need animation ideally
  fullWidthBtn: { backgroundColor: '#a63f00', borderRadius: 14, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fullWidthBtnTxt: { color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  deliverySummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#faf8f5', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  summaryLeft: { gap: 4 },
  summaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b1c1c' },
  summaryStatus: { fontSize: 11, fontWeight: '900', color: '#22c55e', letterSpacing: 1 },
  summaryRight: { alignItems: 'flex-end', gap: 2 },
  summaryFeeVal: { fontSize: 18, fontWeight: '900', color: '#a63f00' },
  summaryFeeLbl: { fontSize: 9, fontWeight: '900', color: '#8e9e95', letterSpacing: 1 },
  emptyStateCard: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#faf8f5', borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  muted: { color: '#8e9e95', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  jobRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1eee9', gap: 12 },
  jobIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  jobTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b1c1c', marginBottom: 2 },
  jobMeta: { fontSize: 11, fontWeight: '600', color: '#8e9e95' },
  jobRight: { alignItems: 'flex-end', gap: 4 },
  jobFee: { fontSize: 14, fontWeight: '900', color: '#1b1c1c' },
  orderCardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1eee9', gap: 12 },
  orderCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b1c1c', marginBottom: 2 },
  orderCardStatus: { fontSize: 10, fontWeight: '900', color: '#a63f00', letterSpacing: 1 },
  orderCardTotal: { fontSize: 14, fontWeight: '900', color: '#1b1c1c' },
});
