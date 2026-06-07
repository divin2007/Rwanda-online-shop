import React from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Bike, Clock, TrendingUp, Wallet } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { useRemote } from '../../src/hooks/useRemote';

type WalletData = {
  availableBalance?: number;
  balance?: number;
  pendingBalance?: number;
  totalEarned?: number;
};

export default function RiderEarningsScreen() {
  const { user, isAuthenticated } = useAuth();

  const { data: wallet, loading: wLoading, refreshing, error: wError, refresh } = useRemote<WalletData>(
    () => isAuthenticated ? api.get('wallet', '/wallets/me') : Promise.resolve({}),
    [isAuthenticated],
  );

  const { data: history } = useRemote<any[]>(
    () => isAuthenticated ? api.get<any[]>('delivery', '/deliveries/history').catch(() => []) : Promise.resolve([]),
    [isAuthenticated],
  );

  const { data: ledger } = useRemote<any[]>(
    () => isAuthenticated ? api.get<any[]>('wallet', '/wallets/ledger').catch(() => []) : Promise.resolve([]),
    [isAuthenticated],
  );

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Your earnings are attached to your rider account." />;
  if (wLoading && !wallet) return <LoadingBlock label="Loading your earnings..." />;
  if (wError && !wallet) return <ErrorBlock message={wError} onRetry={refresh} />;

  const available = wallet?.availableBalance ?? wallet?.balance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const deliveries = asArray<any>(history);
  const ledgerEntries = asArray<any>(ledger);

  // Compute quick stats
  const totalDeliveries = deliveries.length;
  const delivered = deliveries.filter((d: any) => d.status === 'delivered').length;
  const avgEarning = totalDeliveries ? deliveries.reduce((s: number, d: any) => s + (d.earnings || d.fee || 0), 0) / totalDeliveries : 0;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Balance hero */}
      <View style={s.hero}>
        <View style={s.heroBlobBig} />
        <View style={s.heroBlobSmall} />
        <View style={s.heroIcon}><Wallet color="#fff" size={26} /></View>
        <Text style={s.heroLabel}>Rider wallet</Text>
        <Text style={s.heroAmount}>{money(available)}</Text>
        <Text style={s.heroSub}>Available balance</Text>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Clock color="rgba(255,255,255,0.7)" size={13} />
            <Text style={s.heroStatText}>Pending: {money(pending)}</Text>
          </View>
          <View style={s.heroStat}>
            <TrendingUp color="rgba(255,255,255,0.7)" size={13} />
            <Text style={s.heroStatText}>Total earned: {money(totalEarned)}</Text>
          </View>
        </View>
      </View>

      {/* Quick stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Bike color={colors.primary} size={20} />
          <Text style={s.statValue}>{totalDeliveries}</Text>
          <Text style={s.statLabel}>Deliveries</Text>
        </View>
        <View style={s.statCard}>
          <TrendingUp color="#16a34a" size={20} />
          <Text style={[s.statValue, { color: '#16a34a' }]}>{delivered}</Text>
          <Text style={s.statLabel}>Completed</Text>
        </View>
        <View style={s.statCard}>
          <Wallet color="#d97706" size={20} />
          <Text style={[s.statValue, { color: '#d97706' }]}>{money(avgEarning)}</Text>
          <Text style={s.statLabel}>Avg/trip</Text>
        </View>
      </View>

      {/* Delivery history */}
      {deliveries.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><Bike color={colors.primary} size={18} /><Text style={s.cardTitle}>Delivery history</Text></View>
          {deliveries.slice(0, 20).map((d: any, i: number) => {
            const earned = d.earnings || d.fee || 0;
            const isDone = d.status === 'delivered';
            return (
              <View key={d._id || i} style={s.txRow}>
                <View style={[s.txIcon, { backgroundColor: isDone ? '#f0fdf4' : '#fff7ed' }]}>
                  <Bike color={isDone ? '#16a34a' : colors.primary} size={15} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc}>Delivery #{String(d._id || d.orderId || '').slice(-6).toUpperCase()}</Text>
                  <Text style={s.txDate}>{d.status?.replace(/_/g, ' ') || 'unknown'} · {formatDateTime(d.createdAt)}</Text>
                </View>
                {earned > 0 && <Text style={[s.txAmount, { color: '#16a34a' }]}>+{money(earned)}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {/* Ledger */}
      {ledgerEntries.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><Wallet color={colors.primary} size={18} /><Text style={s.cardTitle}>Ledger</Text></View>
          {ledgerEntries.slice(0, 15).map((tx: any, i: number) => {
            const isCredit = tx.type === 'credit';
            return (
              <View key={tx._id || i} style={s.txRow}>
                <View style={[s.txIcon, { backgroundColor: isCredit ? '#f0fdf4' : '#fef2f2' }]}>
                  {isCredit ? <ArrowDownLeft color="#16a34a" size={15} /> : <ArrowUpRight color="#dc2626" size={15} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc} numberOfLines={2}>{tx.description || (isCredit ? 'Credit' : 'Debit')}</Text>
                  <Text style={s.txDate}>{formatDateTime(tx.createdAt)}</Text>
                </View>
                <Text style={[s.txAmount, { color: isCredit ? '#16a34a' : '#dc2626' }]}>
                  {isCredit ? '+' : '-'}{money(tx.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {deliveries.length === 0 && ledgerEntries.length === 0 && (
        <EmptyBlock title="No earnings yet" body="Accept and complete deliveries to start earning RWF per trip." />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: 28, alignItems: 'center', gap: 6, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  heroBlobBig: { position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlobSmall: { position: 'absolute', left: -30, bottom: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroAmount: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  heroStats: { flexDirection: 'row', gap: 20, marginTop: 8 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#17201a' },
  statLabel: { fontSize: 11, color: '#80756c', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#17201a' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#ebdcd0' },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#17201a' },
  txDate: { fontSize: 11, color: '#80756c', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
});
