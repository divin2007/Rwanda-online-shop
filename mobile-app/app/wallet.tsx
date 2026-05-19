import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton } from '../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';
import { formatDateTime, money } from '../src/lib/format';
import { asArray } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { Wallet } from '../src/types';
import { useRemote } from '../src/hooks/useRemote';

export default function WalletScreen() {
  const { user, isAuthenticated } = useAuth();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, refreshing, error, refresh } = useRemote<Wallet & { transactions?: any[] }>(
    () => isAuthenticated ? api.get('wallet', '/wallets/me') : Promise.resolve({}),
    [isAuthenticated],
  );

  const requestPayout = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await api.post('wallet', '/wallets/payout-request', { amount: Number(amount), method: 'momo', recipientPhone: phone });
      setAmount('');
      Alert.alert('Payout requested', 'RMF accounting will process this payout request.');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}>
      <View style={styles.balance}>
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.amount}>{money(data?.balance || data?.availableBalance)}</Text>
        <Text style={styles.meta}>Escrow releases appear here after confirmed delivery.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Request payout</Text>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="RWF" />
        <Field label="MoMo number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XXXXXXXX" />
        <PrimaryButton label="Request payout" onPress={requestPayout} loading={submitting} disabled={!amount || !phone} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Transactions</Text>
        {transactions.length ? transactions.map((tx, index) => (
          <View key={tx._id || index} style={styles.tx}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txTitle}>{tx.type || tx.description || 'Wallet transaction'}</Text>
              <Text style={styles.txMeta}>{formatDateTime(tx.createdAt)}</Text>
            </View>
            <Text style={styles.txAmount}>{money(tx.amount)}</Text>
          </View>
        )) : <Text style={styles.empty}>No wallet transactions returned.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14 },
  balance: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 20, gap: 8 },
  label: { color: colors.orange, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  amount: { color: colors.card, fontSize: 32, fontWeight: '900' },
  meta: { color: '#ffedd5', fontSize: 12, lineHeight: 18 },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  txTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  txMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  txAmount: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  empty: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
