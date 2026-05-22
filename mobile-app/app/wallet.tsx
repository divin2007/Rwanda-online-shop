import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from 'lucide-react-native';
import { Field, PrimaryButton } from '../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';
import { formatDateTime, money } from '../src/lib/format';
import { asArray } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { Wallet } from '../src/types';
import { useRemote } from '../src/hooks/useRemote';

type WalletFull = Wallet & {
  availableBalance?: number;
  pendingBalance?: number;
  escrowBalance?: number;
  transactions?: any[];
};

export default function WalletScreen() {
  const { user, isAuthenticated } = useAuth();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refreshing, error, refresh } = useRemote<WalletFull>(
    () => isAuthenticated ? api.get('wallet', '/wallets/me') : Promise.resolve({}),
    [isAuthenticated],
  );

  const requestPayout = async () => {
    if (!user) return;
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid RWF amount to withdraw.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('wallet', '/wallets/payout-request', {
        amount: Number(amount),
        method: 'momo',
        recipientPhone: phone,
      });
      setAmount('');
      Alert.alert('Payout requested', 'RMF accounting will process this payout request within 24 hours.');
      refresh();
    } catch (err) {
      Alert.alert('Payout failed', err instanceof Error ? err.message : 'Could not request payout.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in for wallet" body="Wallet balances and payouts require an authenticated RMF account." />;
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const transactions = asArray<any>((data as any)?.transactions);
  const available = data?.availableBalance ?? data?.balance ?? 0;
  const pending = data?.pendingBalance ?? 0;
  const escrow = (data as any)?.escrowBalance ?? 0;

  const txType = (tx: any): 'credit' | 'debit' => {
    const t = String(tx.type || '').toLowerCase();
    return t.includes('payout') || t.includes('withdraw') || t.includes('debit') ? 'debit' : 'credit';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      {/* ── Balance card (3 buckets like web) ─────────────────── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <WalletIcon color={colors.orange} size={20} />
          <Text style={styles.balanceLabel}>RMF Wallet</Text>
        </View>
        <Text style={styles.balanceAmount}>{money(available)}</Text>
        <Text style={styles.balanceSub}>Available for withdrawal</Text>

        <View style={styles.balanceDivider} />

        <View style={styles.bucketRow}>
          <View style={styles.bucket}>
            <Text style={styles.bucketValue}>{money(pending)}</Text>
            <Text style={styles.bucketLabel}>Pending</Text>
          </View>
          <View style={styles.bucketDivider} />
          <View style={styles.bucket}>
            <Text style={styles.bucketValue}>{money(escrow)}</Text>
            <Text style={styles.bucketLabel}>In escrow</Text>
          </View>
        </View>
        <Text style={styles.balanceNote}>Escrow releases after confirmed delivery.</Text>
      </View>

      {/* ── Payout request ───────────────────────────────────── */}
      <View style={styles.panel}>
        <Text style={styles.title}>Request payout</Text>
        <Field label="Amount (RWF)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="e.g. 5000" />
        <Field label="MoMo number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XXXXXXXX" />
        <PrimaryButton
          label="Request payout"
          onPress={requestPayout}
          loading={submitting}
          disabled={!amount || !phone || Number(amount) > available}
        />
        {Number(amount) > available && amount !== '' && (
          <Text style={styles.warning}>Amount exceeds available balance.</Text>
        )}
      </View>

      {/* ── Transaction history ──────────────────────────────── */}
      <View style={styles.panel}>
        <Text style={styles.title}>Transactions</Text>
        {transactions.length ? transactions.map((tx, index) => {
          const isCredit = txType(tx) === 'credit';
          return (
            <View key={tx._id || index} style={styles.tx}>
              <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
                {isCredit
                  ? <ArrowDownLeft color={colors.success ?? '#16a34a'} size={14} />
                  : <ArrowUpRight color={colors.danger} size={14} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{tx.description || tx.type || 'Wallet transaction'}</Text>
                <Text style={styles.txMeta}>{formatDateTime(tx.createdAt)}</Text>
              </View>
              <Text style={[styles.txAmount, !isCredit && styles.txDebit]}>
                {isCredit ? '+' : '-'}{money(Math.abs(tx.amount || 0))}
              </Text>
            </View>
          );
        }) : (
          <Text style={styles.empty}>No wallet transactions yet. Earnings appear here after deliveries are confirmed.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  // Balance card
  balanceCard: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 20, gap: 6 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { color: '#ffedd5', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  balanceAmount: { color: colors.card, fontSize: 34, fontWeight: '900', marginTop: 4 },
  balanceSub: { color: '#ffedd5', fontSize: 11, fontWeight: '700' },
  balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 12 },
  bucketRow: { flexDirection: 'row', alignItems: 'center' },
  bucket: { flex: 1, alignItems: 'center', gap: 4 },
  bucketDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
  bucketValue: { color: colors.card, fontSize: 16, fontWeight: '900' },
  bucketLabel: { color: '#ffedd5', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  balanceNote: { color: 'rgba(255,237,213,0.7)', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  // Panel
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  warning: { color: colors.danger, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  // Tx
  tx: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txIconCredit: { backgroundColor: '#dcfce7' },
  txIconDebit: { backgroundColor: '#fee2e2' },
  txTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  txMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  txAmount: { color: colors.success ?? '#16a34a', fontSize: 13, fontWeight: '900' },
  txDebit: { color: colors.danger },
  empty: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
