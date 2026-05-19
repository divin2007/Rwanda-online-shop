import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Clock, ReceiptText } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Order } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

export default function OrdersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh } = useRemote<Order[]>(
    () => isAuthenticated ? api.get<Order[]>('order', '/orders') : Promise.resolve([]),
    [isAuthenticated],
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <EmptyBlock title="Sign in to view orders" body="Your escrow orders and live tracking are attached to your RMF account." actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />
      </View>
    );
  }
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const orders = asArray<Order>(data);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <ReceiptText color={colors.orange} size={22} />
        <View>
          <Text style={styles.title}>My orders</Text>
          <Text style={styles.subtitle}>{orders.length} order records from the order service</Text>
        </View>
      </View>

      {orders.length ? orders.map(order => (
        <TouchableOpacity key={order._id} style={styles.card} onPress={() => router.push(`/orders/${order._id}`)} activeOpacity={0.85}>
          <View style={styles.cardHeader}>
            <Text style={styles.orderNumber}>#{shortId(order.orderNumber || order._id)}</Text>
            <View style={styles.status}><Text style={styles.statusText}>{order.status || 'pending'}</Text></View>
          </View>
          <Text style={styles.seller}>{order.seller?.fullName || order.seller?.stallId || 'Seller'}</Text>
          <View style={styles.metaRow}>
            <Clock color={colors.faint} size={14} />
            <Text style={styles.meta}>{formatDateTime(order.createdAt)}</Text>
            <Text style={styles.total}>{money(order.financials?.totalAmount)}</Text>
          </View>
        </TouchableOpacity>
      )) : (
        <EmptyBlock title="No orders yet" body="Orders created through checkout will appear here." />
      )}

      <Link href="/notifications" asChild>
        <TouchableOpacity style={styles.secondary}>
          <Text style={styles.secondaryText}>Open notifications</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 14 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  status: { backgroundColor: colors.orangeSoft, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  seller: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, color: colors.faint, fontSize: 11, fontWeight: '700' },
  total: { color: colors.greenDark, fontSize: 13, fontWeight: '900' },
  secondary: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.orangeDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});

