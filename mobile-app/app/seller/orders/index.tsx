import React, { useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, Package, ShoppingBag } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../src/components/StateView';
import { useAuth } from '../../../src/context/AuthContext';
import { api } from '../../../src/lib/api';
import { formatDateTime, money } from '../../../src/lib/format';
import { asArray } from '../../../src/lib/normalize';
import { colors } from '../../../src/theme';
import { Order } from '../../../src/types';
import { useRemote } from '../../../src/hooks/useRemote';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PLACED:               { bg: '#eff6ff', text: '#2563eb' },
  CONFIRMED:            { bg: '#f0fdf4', text: '#16a34a' },
  PREPARING:            { bg: '#fffbeb', text: '#d97706' },
  READY_FOR_PICKUP:     { bg: '#f5f3ff', text: '#7c3aed' },
  PICKED_UP:            { bg: '#ecfeff', text: '#0891b2' },
  IN_TRANSIT:           { bg: '#ecfeff', text: '#0891b2' },
  DELIVERED:            { bg: '#f0fdf4', text: '#16a34a' },
  CANCELLED:            { bg: '#fef2f2', text: '#dc2626' },
  DISPUTED:             { bg: '#fef2f2', text: '#dc2626' },
  RESOLVED:             { bg: '#f0fdf4', text: '#16a34a' },
  AWAITING_QUOTE:       { bg: '#fffbeb', text: '#d97706' },
  QUOTE_SENT:           { bg: '#eff6ff', text: '#2563eb' },
  AWAITING_CONFIRMATION:{ bg: '#fffbeb', text: '#d97706' },
  SCHEDULED:            { bg: '#f5f3ff', text: '#7c3aed' },
};

const FILTERS = ['All', 'Active', 'Preparing', 'Delivered', 'Cancelled'];
const ACTIVE_STATES = ['PLACED','CONFIRMED','AWAITING_QUOTE','QUOTE_SENT','AWAITING_CONFIRMATION','SCHEDULED'];
const FILTER_MAP: Record<string, string[]> = {
  All: [],
  Active: ACTIVE_STATES,
  Preparing: ['PREPARING','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT'],
  Delivered: ['DELIVERED','RESOLVED'],
  Cancelled: ['CANCELLED','DISPUTED'],
};

export default function SellerOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState('All');

  const sellerUserId = user?.id || user?._id;
  const { data, loading, refreshing, error, refresh } = useRemote<Order[]>(
    () => api.get<Order[]>('order', `/orders?sellerId=${sellerUserId}&limit=100`).catch(() => []),
    [sellerUserId],
  );

  const orders = asArray<Order>(data);
  const allowed = FILTER_MAP[filter];
  const filtered = allowed.length ? orders.filter(o => allowed.includes(o.status ?? '')) : orders;

  if (loading && !data) return <LoadingBlock label="Loading orders..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
        {FILTERS.map(f => {
          const count = f === 'All' ? orders.length : (orders.filter(o => FILTER_MAP[f].includes(o.status ?? '')).length);
          const active = filter === f;
          return (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.chip, active && s.chipActive]}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f}{count > 0 ? ` (${count})` : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 && (
        <EmptyBlock title="No orders here" body="Orders matching this filter will appear here." />
      )}

      {filtered.map((order, i) => {
        const sc = STATUS_COLORS[order.status ?? ''] || { bg: '#f5f5f5', text: '#555' };
        const total = order.financials?.totalAmount ?? 0;
        const itemCount = order.products?.length ?? 0;
        return (
          <TouchableOpacity key={order._id || i} style={s.card}
            onPress={() => router.push(`/seller/orders/${order._id}` as any)} activeOpacity={0.85}>
            <View style={s.cardTop}>
              <View style={s.orderIdRow}>
                <ShoppingBag color={colors.primary} size={15} />
                <Text style={s.orderId}>#{String(order._id).slice(-8).toUpperCase()}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[s.statusText, { color: sc.text }]}>{order.status?.replace(/_/g, ' ')}</Text>
              </View>
            </View>

            <View style={s.cardMid}>
              <View style={s.metaItem}>
                <Package color="#a89b91" size={13} />
                <Text style={s.metaText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.metaItem}>
                <Clock color="#a89b91" size={13} />
                <Text style={s.metaText}>{formatDateTime(order.createdAt)}</Text>
              </View>
            </View>

            <View style={s.cardBottom}>
              <Text style={s.totalLabel}>Total</Text>
              <View style={s.totalRight}>
                <Text style={s.totalValue}>{money(total)}</Text>
                <ChevronRight color="#c0b8b0" size={16} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { paddingVertical: 14, gap: 10, paddingBottom: 48 },
  filterRow: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ebdcd0' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#574e47' },
  chipTextActive: { color: '#fff' },
  card: {
    marginHorizontal: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderId: { fontSize: 14, fontWeight: '800', color: '#17201a' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardMid: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#80756c' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0e8e0' },
  totalLabel: { fontSize: 13, color: '#80756c', fontWeight: '600' },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#17201a' },
});
