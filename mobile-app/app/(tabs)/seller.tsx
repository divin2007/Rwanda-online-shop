import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bike, Box, ClipboardList, Heart, MapPin, ReceiptText, Settings, ShieldCheck, Store, Wallet } from 'lucide-react-native';
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
  if (loading && !data) return <LoadingBlock label="Loading your RMF dashboard..." />;
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
      <View style={styles.hero}>
        <ShieldCheck color={colors.orange} size={25} />
        <Text style={styles.kicker}>Buyer dashboard</Text>
        <Text style={styles.title}>Orders, escrow, tracking, and saved products.</Text>
      </View>
      <View style={styles.stats}>
        <Metric icon={<ReceiptText color={colors.orange} size={18} />} value={data.orders.length} label="Orders" />
        <Metric icon={<Wallet color={colors.orange} size={18} />} value={money(data.wallet?.availableBalance ?? data.wallet?.balance)} label="Wallet" />
      </View>
      <View style={styles.actions}>
        <Action label="Browse markets" onPress={() => router.push('/markets')} />
        <Action label="Track orders" onPress={() => router.push('/orders')} />
        <Action label="Wishlist" onPress={() => router.push('/wishlist')} icon={<Heart color={colors.greenDark} size={15} />} />
        <Action label="Settings" onPress={() => router.push('/settings')} icon={<Settings color={colors.greenDark} size={15} />} />
      </View>
      {activeOrder?.delivery ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Current tracking</Text>
          <MapPreview
            title={`Order #${shortId(activeOrder.orderNumber || activeOrder._id)}`}
            points={[
              { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(activeOrder.delivery?.pickup || activeOrder.delivery?.pickupLocation) },
              { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(activeOrder.delivery?.dropoff || activeOrder.delivery?.dropoffLocation || activeOrder.delivery?.destination) },
              { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(activeOrder.delivery?.currentLocation || activeOrder.delivery?.riderLocation) },
            ]}
          />
          <Action label="Open full tracking" onPress={() => router.push(`/orders/${activeOrder._id}`)} />
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
    return <EmptyBlock title="Complete seller onboarding" body="Your seller profile has not been created yet." actionLabel="Start onboarding" onAction={() => router.push('/seller/onboarding')} />;
  }

  return (
    <HubScroll refreshing={refreshing} refresh={refresh}>
      <View style={styles.hero}>
        <Store color={colors.orange} size={25} />
        <Text style={styles.kicker}>Seller dashboard</Text>
        <Text style={styles.title}>{seller.shopDetails?.name || seller.stallName}</Text>
        <View style={styles.approval}>
          <BadgeCheck color={seller.isApproved ? colors.success : colors.warning} size={15} />
          <Text style={styles.approvalText}>{seller.isApproved ? 'Approved seller' : 'Waiting for admin approval'}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Metric icon={<Wallet color={colors.orange} size={18} />} value={money(data.wallet?.balance || data.wallet?.availableBalance)} label="Wallet" />
        <Metric icon={<Box color={colors.orange} size={18} />} value={data.products.length} label="Products" />
        <Metric icon={<ClipboardList color={colors.orange} size={18} />} value={data.orders.length} label="Orders" />
      </View>
      <View style={styles.actions}>
        <Action label="Manage inventory" onPress={() => router.push('/seller/products')} />
        <Action label="Promotions" onPress={() => router.push('/seller/promotions')} />
        <Action label="Video ads" onPress={() => router.push('/seller/videos')} />
        <Action label="Edit profile" onPress={() => router.push('/seller/onboarding')} />
        <Action label="Wallet payouts" onPress={() => router.push('/wallet')} />
      </View>
      <RecentOrders orders={data.orders} seller />
    </HubScroll>
  );
}

function RiderHub({ data, refreshing, refresh }: { data: HubPayload; refreshing: boolean; refresh: () => void }) {
  const router = useRouter();
  const active = data.activeDelivery;
  return (
    <HubScroll refreshing={refreshing} refresh={refresh}>
      <View style={styles.hero}>
        <Bike color={colors.orange} size={26} />
        <Text style={styles.kicker}>Rider dashboard</Text>
        <Text style={styles.title}>Deliveries, proof, live map, and tracking.</Text>
      </View>
      <View style={styles.stats}>
        <Metric icon={<MapPin color={colors.orange} size={18} />} value={active ? 1 : 0} label="Active" />
        <Metric icon={<ClipboardList color={colors.orange} size={18} />} value={data.availableDeliveries.length} label="Available" />
        <Metric icon={<Wallet color={colors.orange} size={18} />} value={money(data.wallet?.availableBalance ?? data.wallet?.balance)} label="Wallet" />
      </View>
      <View style={styles.actions}>
        <Action label="Open deliveries" onPress={() => router.push('/rider/deliveries')} />
        <Action label="Wallet payouts" onPress={() => router.push('/wallet')} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Live delivery map</Text>
        <MapPreview
          title={active ? `Delivery #${shortId(active._id)}` : 'Delivery tracking'}
          points={[
            { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(active?.pickup) },
            { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(active?.dropoff) },
            { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(active?.currentLocation) },
          ]}
        />
        {active ? (
          <View style={styles.deliverySummary}>
            <Text style={styles.orderTitle}>Status: {active.status || 'pending'}</Text>
            <Text style={styles.orderMeta}>Fee: {money(active.earnings || active.fee)}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>No active delivery is assigned right now.</Text>
        )}
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Available jobs</Text>
        {data.availableDeliveries.length ? data.availableDeliveries.slice(0, 5).map(delivery => (
          <TouchableOpacity key={delivery._id} style={styles.orderRow} onPress={() => router.push('/rider/deliveries')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderTitle}>Delivery #{shortId(delivery._id)}</Text>
              <Text style={styles.orderMeta}>{delivery.status || 'available'} - {formatDateTime(delivery.createdAt)}</Text>
            </View>
            <Text style={styles.orderTotal}>{money(delivery.earnings || delivery.fee)}</Text>
          </TouchableOpacity>
        )) : <Text style={styles.muted}>No available delivery jobs right now.</Text>}
      </View>
    </HubScroll>
  );
}

function HubScroll({ children, refreshing, refresh }: { children: React.ReactNode; refreshing: boolean; refresh: () => void }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress, icon }: { label: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.85}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function RecentOrders({ orders, seller }: { orders: Order[]; seller?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Recent orders</Text>
      {orders.length ? orders.slice(0, 6).map(order => (
        <TouchableOpacity key={order._id} style={styles.orderRow} onPress={() => router.push(seller ? `/seller/orders/${order._id}` : `/orders/${order._id}`)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderTitle}>#{order.orderNumber || shortId(order._id)}</Text>
            <Text style={styles.orderMeta}>{order.status || 'pending'} - {formatDateTime(order.createdAt)}</Text>
          </View>
          <Text style={styles.orderTotal}>{money(order.financials?.totalAmount)}</Text>
        </TouchableOpacity>
      )) : <Text style={styles.muted}>No orders returned yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.orangeDark, borderRadius: 16, padding: 18, gap: 8 },
  kicker: { color: colors.orangeSoft, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.card, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  approval: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  approvalText: { color: '#ffedd5', fontSize: 12, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 5 },
  statValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  actions: { gap: 10 },
  action: { minHeight: 46, borderRadius: 10, backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  orderTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  orderMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  orderTotal: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  deliverySummary: { gap: 4 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
