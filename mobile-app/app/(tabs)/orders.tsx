import React, { useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Clock, ReceiptText, Search, SlidersHorizontal } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { normalizeImageUrl } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Order } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

// Semantic status colors matching the web
const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  placed:               { bg: '#fff7ed', text: '#ea580c' },
  confirmed:            { bg: '#eff6ff', text: '#2563eb' },
  preparing:            { bg: '#fffbeb', text: '#d97706' },
  ready_for_pickup:     { bg: '#f5f3ff', text: '#7c3aed' },
  picked_up:            { bg: '#ecfeff', text: '#0891b2' },
  in_transit:           { bg: '#ecfeff', text: '#0891b2' },
  awaiting_confirmation:{ bg: '#fff7ed', text: '#ea580c' },
  delivered:            { bg: '#f0fdf4', text: '#16a34a' },
  cancelled:            { bg: '#fef2f2', text: '#dc2626' },
  disputed:             { bg: '#fef2f2', text: '#dc2626' },
  resolved:             { bg: '#f0fdf4', text: '#16a34a' },
};

const statusPalette = (s?: string) =>
  STATUS_PALETTE[String(s || '').toLowerCase()] ?? { bg: colors.orangeSoft, text: colors.orangeDark };

const firstProductImage = (order: Order): string | undefined => {
  const products = order.products || (order.product ? [order.product] : []);
  const raw = (products as any[])[0]?.imageUrl || (products as any[])[0]?.images?.[0];
  return normalizeImageUrl(raw);
};

export default function OrdersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'disputes'>('all');
  const { data, loading, refreshing, error, refresh } = useRemote<Order[]>(
    () => isAuthenticated ? api.get<Order[]>('order', '/orders') : Promise.resolve([]),
    [isAuthenticated],
  );

  const orders = asArray<Order>(data);
  const filteredOrders = useMemo(() => {
    const norm = query.trim().toLowerCase();
    return orders.filter(order => {
      const status = String(order.status || '').toLowerCase();
      if (filter === 'active' && ['delivered', 'cancelled', 'resolved'].includes(status)) return false;
      if (filter === 'delivered' && status !== 'delivered') return false;
      if (filter === 'disputes' && !['disputed', 'resolved'].includes(status)) return false;
      if (!norm) return true;
      const haystack = [
        order.orderNumber, order._id, order.status,
        order.seller?.fullName, order.seller?.stallId,
        ...(order.products || []).map((p: any) => p.name),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(norm);
    });
  }, [data, filter, query]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <EmptyBlock
          title="Sign in to view orders"
          body="Your escrow orders and live tracking are attached to your RMF account."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      </View>
    );
  }
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <ReceiptText color={colors.orange} size={22} />
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>{filteredOrders.length} of {orders.length} records</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search color={colors.body} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search order, seller, product..."
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <SlidersHorizontal color={colors.body} size={18} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <OrderFilter label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <OrderFilter label="Active" active={filter === 'active'} onPress={() => setFilter('active')} />
        <OrderFilter label="Delivered" active={filter === 'delivered'} onPress={() => setFilter('delivered')} />
        <OrderFilter label="Disputes" active={filter === 'disputes'} onPress={() => setFilter('disputes')} />
      </ScrollView>

      {filteredOrders.length ? filteredOrders.map(order => {
        const palette = statusPalette(order.status);
        const thumb = firstProductImage(order);
        return (
          <TouchableOpacity
            key={order._id}
            style={styles.card}
            onPress={() => router.push(`/orders/${order._id}` as any)}
            activeOpacity={0.85}
          >
            {/* Thumbnail */}
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <ReceiptText color={colors.faint} size={20} />
              </View>
            )}

            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderNumber}>#{shortId(order.orderNumber || order._id)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statusText, { color: palette.text }]}>
                    {String(order.status || 'placed').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.seller} numberOfLines={1}>
                {order.seller?.fullName || order.seller?.stallId || 'Seller'}
              </Text>
              <View style={styles.metaRow}>
                <Clock color={colors.faint} size={13} />
                <Text style={styles.meta}>{formatDateTime(order.createdAt)}</Text>
                <Text style={styles.total}>{money(order.financials?.totalAmount)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }) : (
        <EmptyBlock title="No orders found" body="Orders created through checkout will appear here." />
      )}

      <Link href="/notifications" asChild>
        <TouchableOpacity style={styles.secondary}>
          <Text style={styles.secondaryText}>Open notifications</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

function OrderFilter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 108 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 14 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  searchBox: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700', paddingVertical: 0 },
  filters: { gap: 8, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  filterText: { color: colors.body, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: colors.primaryDark },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden' },
  thumbFallback: { backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  statusBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  seller: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, color: colors.faint, fontSize: 11, fontWeight: '700' },
  total: { color: colors.greenDark, fontSize: 13, fontWeight: '900' },
  secondary: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.orangeDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});
