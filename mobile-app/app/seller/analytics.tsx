import React, { useMemo, useState } from 'react';
import {
  Dimensions, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  BarChart3, Package, ReceiptText, ShoppingBag, Star, TrendingUp, Wallet, ArrowUpRight,
} from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { compactNumber, money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors, radii, shadow, shadowMd, spacing, typography } from '../../src/theme';
import { useRemote } from '../../src/hooks/useRemote';

const { width: W } = Dimensions.get('window');
const BAR_MAX_H = 100;
type Period = '7d' | '30d' | '90d';
const PERIOD_LABELS: Record<Period, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
const STATUS_COLOR: Record<string, string> = {
  delivered: '#16a34a', in_transit: '#0891b2', confirmed: '#2563eb',
  preparing: '#d97706', cancelled: '#dc2626', disputed: '#dc2626',
};

async function loadAnalytics(userId: string, period: Period) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const [orders, wallet, products, seller] = await Promise.all([
    api.get<any[]>('order', '/orders?limit=200').catch(() => []),
    api.get<any>('wallet', '/wallets/me').catch(() => null),
    api.get<any[]>('product', `/products?sellerId=${encodeURIComponent(userId)}&limit=50`).catch(() => []),
    api.get<any>('seller', '/sellers/me').catch(() => null),
  ]);
  const allOrders = asArray<any>(orders);
  const cutoff = Date.now() - days * 86400000;
  const periodOrders = allOrders.filter((o: any) => new Date(o.createdAt || 0).getTime() >= cutoff);
  const totalRevenue = periodOrders.reduce((s: number, o: any) => s + (o.financials?.sellerPayout || o.financials?.subtotal || 0), 0);
  const totalOrders = periodOrders.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const buckets: Record<string, { revenue: number; orders: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    buckets[key] = { revenue: 0, orders: 0 };
  }
  periodOrders.forEach((o: any) => {
    const d = new Date(o.createdAt || 0);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (buckets[key]) { buckets[key].revenue += o.financials?.sellerPayout || o.financials?.subtotal || 0; buckets[key].orders += 1; }
  });
  const dailySales = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
  const prodMap: Record<string, { name: string; revenue: number; orders: number }> = {};
  periodOrders.forEach((o: any) => {
    (o.products || []).forEach((p: any) => {
      const id = p.productId || p._id || p.name;
      if (!prodMap[id]) prodMap[id] = { name: p.name || 'Product', revenue: 0, orders: 0 };
      prodMap[id].revenue += (p.unitPrice || 0) * (p.quantity || 1);
      prodMap[id].orders += 1;
    });
  });
  const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const statusMap: Record<string, number> = {};
  periodOrders.forEach((o: any) => { const s = o.status || 'unknown'; statusMap[s] = (statusMap[s] || 0) + 1; });
  const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
  return {
    totalRevenue, totalOrders, avgOrderValue,
    totalProducts: asArray<any>(products).length,
    rating: seller?.rating || 0,
    pendingPayout: wallet?.pendingBalance || wallet?.escrowBalance || 0,
    dailySales, topProducts, statusBreakdown,
  };
}

export default function SellerAnalyticsScreen() {
  const { user, isAuthenticated } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const { data, loading, refreshing, error, refresh } = useRemote(
    () => isAuthenticated && user ? loadAnalytics(user.id, period) : Promise.resolve(null as any),
    [isAuthenticated, user?.id, period],
  );
  const maxRevenue = useMemo(() => Math.max(...(data?.dailySales || []).map((d: any) => d.revenue), 1), [data?.dailySales]);

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Analytics are only visible to authenticated sellers." />;
  if (loading && !data) return <LoadingBlock label="Crunching your numbers..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={s.header}>
        <View style={s.headerIcon}><BarChart3 color="#fff" size={22} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Analytics</Text>
          <Text style={s.headerSub}>Your store performance at a glance</Text>
        </View>
      </View>
      <View style={s.periodRow}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodBtnActive]} onPress={() => setPeriod(p)} activeOpacity={0.8}>
            <Text style={[s.periodText, period === p && s.periodTextActive]}>{PERIOD_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.kpiGrid}>
        <KPI icon={<Wallet color={colors.primary} size={18} />} label="Revenue" value={money(data.totalRevenue)} sub={`Last ${PERIOD_LABELS[period]}`} />
        <KPI icon={<ReceiptText color="#2563eb" size={18} />} label="Orders" value={String(data.totalOrders)} sub="Total placed" accent="#2563eb" />
        <KPI icon={<TrendingUp color="#16a34a" size={18} />} label="Avg order" value={money(data.avgOrderValue)} sub="Per order" accent="#16a34a" />
        <KPI icon={<Package color="#d97706" size={18} />} label="Products" value={String(data.totalProducts)} sub="Listed" accent="#d97706" />
      </View>
      <View style={s.card}>
        <View style={s.cardHeader}><BarChart3 color={colors.primary} size={16} /><Text style={s.cardTitle}>Daily revenue — {PERIOD_LABELS[period]}</Text></View>
        {data.dailySales.every((d: any) => d.revenue === 0) ? (
          <Text style={s.emptyChart}>No sales in this period yet</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartScroll}>
            <View style={s.chart}>
              {data.dailySales.map((day: any, i: number) => {
                const h = Math.max(4, (day.revenue / maxRevenue) * BAR_MAX_H);
                return (
                  <View key={i} style={s.barCol}>
                    <Text style={s.barVal}>{day.revenue > 0 ? compactNumber(day.revenue) : ''}</Text>
                    <View style={[s.bar, { height: h }]} />
                    <Text style={s.barLabel}>{day.date}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
      {data.statusBreakdown.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><ShoppingBag color={colors.primary} size={16} /><Text style={s.cardTitle}>Order breakdown</Text></View>
          {data.statusBreakdown.sort((a: any, b: any) => b.count - a.count).map(({ status, count }: any) => {
            const pct = (count / data.totalOrders) * 100;
            const color = STATUS_COLOR[status] || colors.primary;
            return (
              <View key={status} style={s.statusRow}>
                <View style={s.statusLeft}><View style={[s.statusDot, { backgroundColor: color }]} /><Text style={s.statusName}>{status.replace(/_/g, ' ')}</Text></View>
                <View style={s.statusBarWrap}><View style={[s.statusBar, { width: `${pct}%`, backgroundColor: color }]} /></View>
                <Text style={s.statusCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
      {data.topProducts.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><TrendingUp color={colors.primary} size={16} /><Text style={s.cardTitle}>Top products</Text></View>
          {data.topProducts.map((p: any, i: number) => (
            <View key={i} style={s.topRow}>
              <View style={s.topRank}><Text style={s.topRankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.topName} numberOfLines={1}>{p.name}</Text><Text style={s.topMeta}>{p.orders} order{p.orders !== 1 ? 's' : ''}</Text></View>
              <Text style={s.topRevenue}>{money(p.revenue)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function KPI({ icon, label, value, sub, accent = colors.primary }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string }) {
  return (
    <View style={[s.kpi, { borderTopColor: accent, borderTopWidth: 3 }]}>
      <View style={s.kpiIcon}>{icon}</View>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiSub}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  headerIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  periodRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.primary },
  periodText: { fontSize: 12, fontWeight: '600', color: '#80756c' },
  periodTextActive: { color: '#fff' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: (W - 32 - 10) / 2, backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  kpiIcon: { marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '700', color: '#17201a' },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: '#17201a' },
  kpiSub: { fontSize: 10, color: '#80756c' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#17201a' },
  emptyChart: { color: '#80756c', fontSize: 12, textAlign: 'center', paddingVertical: 24 },
  chartScroll: { paddingVertical: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minWidth: W - 64 },
  barCol: { alignItems: 'center', gap: 4, minWidth: 28 },
  barVal: { fontSize: 8, color: '#80756c', fontWeight: '700' },
  bar: { width: 20, backgroundColor: colors.primary, borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 8, color: '#80756c', fontWeight: '600', textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 130 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusName: { fontSize: 12, color: '#17201a', fontWeight: '500', textTransform: 'capitalize' },
  statusBarWrap: { flex: 1, height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  statusBar: { height: '100%', borderRadius: 3 },
  statusCount: { fontSize: 12, fontWeight: '700', color: '#17201a', width: 28, textAlign: 'right' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#ebdcd0' },
  topRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffedd5', alignItems: 'center', justifyContent: 'center' },
  topRankText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  topName: { fontSize: 14, fontWeight: '600', color: '#17201a' },
  topMeta: { fontSize: 10, color: '#80756c' },
  topRevenue: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
