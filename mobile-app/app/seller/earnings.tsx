import React, { useState } from 'react';
import {
  Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  ArrowDownLeft, ArrowUpRight, CheckCircle2,
  Clock, Wallet, TrendingUp, Phone,
} from 'lucide-react-native';
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
  role?: string;
  transactions?: any[];
};

type PayoutRequest = {
  _id: string;
  amount: number;
  method?: string;
  recipientPhone?: string;
  status?: string;
  createdAt?: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
  completed: { bg: '#f0fdf4', color: '#16a34a', label: 'Paid out' },
  failed:    { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
};

export default function SellerEarningsScreen() {
  const { user, isAuthenticated } = useAuth();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const { data: wallet, loading, refreshing, error, refresh } = useRemote<WalletData>(
    () => isAuthenticated ? api.get('wallet', '/wallets/me') : Promise.resolve({}),
    [isAuthenticated],
  );

  const { data: payouts, refresh: refreshPayouts } = useRemote<PayoutRequest[]>(
    () => isAuthenticated ? api.get<PayoutRequest[]>('wallet', '/wallets/payout-requests').catch(() => []) : Promise.resolve([]),
    [isAuthenticated],
  );

  const available = wallet?.availableBalance ?? wallet?.balance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const ledger = asArray<any>((wallet as any)?.transactions || (wallet as any)?.ledger);

  const requestPayout = async () => {
    const amt = Number(amount);
    if (!amt || amt < 500) { Alert.alert('Minimum 500 RWF', 'Enter at least 500 RWF to request a payout.'); return; }
    if (!phone.trim()) { Alert.alert('Phone required', 'Enter your MoMo phone number.'); return; }
    if (amt > available) { Alert.alert('Insufficient balance', `Your available balance is ${money(available)}.`); return; }
    setSubmitting(true);
    try {
      await api.post('wallet', '/wallets/payout-request', { amount: amt, method: 'momo', recipientPhone: phone.trim() });
      setAmount('');
      Alert.alert('Payout requested ✓', 'RMF will process your payout within 24 hours.');
      refresh(); refreshPayouts();
    } catch (err) {
      Alert.alert('Payout failed', err instanceof Error ? err.message : 'Could not request payout.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Your earnings are attached to your RMF account." />;
  if (loading && !wallet) return <LoadingBlock label="Loading your wallet..." />;
  if (error && !wallet) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Balance card */}
      <View style={s.balanceCard}>
        <View style={s.balanceBlob} />
        <Text style={s.balanceLabel}>Available to withdraw</Text>
        <Text style={s.balanceAmount}>{money(available)}</Text>
        <View style={s.balanceRow}>
          <View style={s.balanceMini}>
            <Clock color="rgba(255,255,255,0.7)" size={12} />
            <Text style={s.balanceMiniText}>Pending: {money(pending)}</Text>
          </View>
          <View style={s.balanceMini}>
            <TrendingUp color="rgba(255,255,255,0.7)" size={12} />
            <Text style={s.balanceMiniText}>Total earned: {money(totalEarned)}</Text>
          </View>
        </View>
      </View>

      {/* Withdraw form */}
      <View style={s.card}>
        <View style={s.cardHeader}><ArrowUpRight color={colors.primary} size={18} /><Text style={s.cardTitle}>Request payout</Text></View>
        <Text style={s.cardSub}>Funds will be sent to your MTN/Airtel MoMo number within 24 hours.</Text>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Amount (RWF)</Text>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="e.g. 5000"
            placeholderTextColor="#a89b91"
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>MoMo phone number</Text>
          <View style={s.inputRow}>
            <Phone color={colors.muted} size={16} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.input, { flex: 1, marginTop: 0, borderWidth: 0 }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="07XXXXXXXX"
              placeholderTextColor="#a89b91"
            />
          </View>
        </View>
        <TouchableOpacity
          style={[s.primaryBtn, (submitting || available < 500) && s.primaryBtnDisabled]}
          onPress={requestPayout}
          disabled={submitting || available < 500}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>{submitting ? 'Submitting...' : 'Request payout'}</Text>
        </TouchableOpacity>
        {available < 500 && <Text style={s.minNote}>Minimum withdrawal is 500 RWF</Text>}
      </View>

      {/* Payout history */}
      {asArray<PayoutRequest>(payouts).length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><CheckCircle2 color={colors.primary} size={18} /><Text style={s.cardTitle}>Payout requests</Text></View>
          {asArray<PayoutRequest>(payouts).map(payout => {
            const st = STATUS_STYLE[payout.status || 'pending'] || STATUS_STYLE.pending;
            return (
              <View key={payout._id} style={s.txRow}>
                <View style={[s.txIcon, { backgroundColor: st.bg }]}>
                  <ArrowUpRight color={st.color} size={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc}>{money(payout.amount)} → {payout.recipientPhone || 'MoMo'}</Text>
                  <Text style={s.txDate}>{formatDateTime(payout.createdAt)}</Text>
                </View>
                <View style={[s.statusChip, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusChipText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Ledger */}
      {ledger.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}><Wallet color={colors.primary} size={18} /><Text style={s.cardTitle}>Ledger history</Text></View>
          {ledger.slice(0, 20).map((tx: any, i: number) => {
            const isCredit = tx.type === 'credit';
            return (
              <View key={tx._id || i} style={s.txRow}>
                <View style={[s.txIcon, { backgroundColor: isCredit ? '#f0fdf4' : '#fef2f2' }]}>
                  {isCredit
                    ? <ArrowDownLeft color="#16a34a" size={16} />
                    : <ArrowUpRight color="#dc2626" size={16} />}
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

      {ledger.length === 0 && asArray<PayoutRequest>(payouts).length === 0 && (
        <EmptyBlock title="No earnings yet" body="Complete orders to earn money. It will appear here once buyers confirm delivery." />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  balanceCard: {
    backgroundColor: colors.primary, borderRadius: 20, padding: 24,
    overflow: 'hidden', gap: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  balanceBlob: { position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  balanceAmount: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  balanceMini: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balanceMiniText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#17201a' },
  cardSub: { fontSize: 12, color: '#80756c', lineHeight: 18 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#80756c', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#ebdcd0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#17201a', backgroundColor: '#fdfaf7', marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ebdcd0', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fdfaf7' },
  primaryBtn: { height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  minNote: { color: '#80756c', fontSize: 11, textAlign: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#ebdcd0' },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#17201a' },
  txDate: { fontSize: 11, color: '#80756c', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 10, fontWeight: '700' },
});
