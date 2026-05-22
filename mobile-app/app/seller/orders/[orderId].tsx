import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight, CheckCircle2, Clock, MessageCircle, Package,
  ShieldCheck, Truck,
} from 'lucide-react-native';
import { OrderLineCard } from '../../../src/components/Cards';
import { ErrorBlock, LoadingBlock } from '../../../src/components/StateView';
import { useAuth } from '../../../src/context/AuthContext';
import { api } from '../../../src/lib/api';
import { formatDateTime, money, shortId } from '../../../src/lib/format';
import { asArray } from '../../../src/lib/normalize';
import { colors } from '../../../src/theme';
import { Order, OrderMessage } from '../../../src/types';
import { useOrderSocket } from '../../../src/hooks/useOrderSocket';
import { useRemote } from '../../../src/hooks/useRemote';

// Seller-visible status transition buttons
type SellerAction = { label: string; status: string; icon: React.ReactNode; color: string };

const getSellerActions = (status: string): SellerAction[] => {
  const s = String(status || '').toLowerCase();
  const actions: SellerAction[] = [];

  if (s === 'placed' || s === 'confirmed') {
    actions.push({
      label: 'Mark as Preparing',
      status: 'preparing',
      icon: <Package color={colors.greenDark} size={16} />,
      color: colors.orange,
    });
  }
  if (s === 'preparing') {
    actions.push({
      label: 'Ready for Pickup',
      status: 'ready_for_pickup',
      icon: <Truck color={colors.greenDark} size={16} />,
      color: '#f59e0b',
    });
  }
  return actions;
};

const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  placed:                { bg: '#fff7ed', text: '#ea580c' },
  confirmed:             { bg: '#eff6ff', text: '#2563eb' },
  preparing:             { bg: '#fffbeb', text: '#d97706' },
  ready_for_pickup:      { bg: '#f5f3ff', text: '#7c3aed' },
  picked_up:             { bg: '#ecfeff', text: '#0891b2' },
  in_transit:            { bg: '#ecfeff', text: '#0891b2' },
  awaiting_confirmation: { bg: '#fff7ed', text: '#ea580c' },
  delivered:             { bg: '#f0fdf4', text: '#16a34a' },
  cancelled:             { bg: '#fef2f2', text: '#dc2626' },
  disputed:              { bg: '#fef2f2', text: '#dc2626' },
};
const palette = (s?: string) => STATUS_PALETTE[String(s || '').toLowerCase()] ?? { bg: colors.orangeSoft, text: colors.orangeDark };

export default function SellerOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const { payload } = useOrderSocket(orderId ? `order:${orderId}:status` : undefined);
  const { data: order, loading, refreshing, error, refresh, setData } = useRemote<Order>(
    () => api.get<Order>('order', `/orders/${orderId}`),
    [orderId],
  );

  React.useEffect(() => {
    if (payload?.order) setData(payload.order);
    else if (payload) refresh();
  }, [payload, refresh, setData]);

  const transitionStatus = async (newStatus: string, label: string) => {
    if (!order || !user) return;
    Alert.alert(
      label,
      `Transition order to "${newStatus.replace(/_/g, ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            setTransitioning(true);
            try {
              const updated = await api.put<Order>('order', `/orders/${order._id}/status`, {
                status: newStatus,
                userId: user.id,
              });
              setData(updated);
              Alert.alert('Updated', `Order moved to "${newStatus.replace(/_/g, ' ')}".`);
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Could not update order status.');
            } finally {
              setTransitioning(false);
            }
          },
        },
      ],
    );
  };

  const sendMessage = async () => {
    if (!order || !user || !message.trim()) return;
    setSending(true);
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/messages`, {
        senderId: user.id,
        senderRole: 'SELLER',
        content: message.trim(),
        type: 'TEXT',
      });
      setData(updated);
      setMessage('');
    } catch (err) {
      Alert.alert('Message failed', err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading && !order) return <LoadingBlock label="Loading order..." />;
  if (error && !order) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!order) return null;

  const lines = asArray<any>(order.products?.length ? order.products : order.product ? [order.product] : []);
  const history = asArray<any>(order.statusHistory);
  const actions = getSellerActions(order.status || '');
  const { bg, text } = palette(order.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <ShieldCheck color={colors.orange} size={20} />
          <Text style={styles.connection}>Seller management view</Text>
        </View>
        <Text style={styles.title}>Order #{shortId(order.orderNumber || order._id)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.statusText, { color: text }]}>
            {String(order.status || 'placed').replace(/_/g, ' ')}
          </Text>
        </View>
        <Text style={styles.buyer}>
          Buyer: {order.buyer?.fullName || 'Customer'} · {order.buyer?.phone || ''}
        </Text>
      </View>

      {/* Seller action buttons */}
      {actions.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Fulfillment actions</Text>
          {actions.map(action => (
            <TouchableOpacity
              key={action.status}
              style={[styles.actionBtn, { backgroundColor: action.color }]}
              onPress={() => transitionStatus(action.status, action.label)}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {action.icon}
              <Text style={styles.actionText}>{action.label}</Text>
              <ArrowRight color={colors.greenDark} size={14} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Financials */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Financials</Text>
        <Row label="Subtotal" value={money(order.financials?.subtotal)} />
        <Row label="Delivery fee" value={money(order.financials?.deliveryFee)} />
        <Row label="Platform commission" value={money(order.financials?.platformCommission)} />
        <Row label="Your payout" value={money(order.financials?.sellerPayout)} highlight />
        <Row label="Payment status" value={order.payment?.status || 'pending'} />
      </View>

      {/* Items */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Order items</Text>
        {lines.map((line, index) => <OrderLineCard key={line.productId || index} item={line} />)}
      </View>

      {/* Delivery info */}
      {order.buyer?.deliveryAddress && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          <Text style={styles.address}>{order.buyer.deliveryAddress?.address || 'Pinned location'}</Text>
          {order.notes ? <Text style={styles.notes}>Notes: {order.notes}</Text> : null}
        </View>
      )}

      {/* Status timeline */}
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <Clock color={colors.orange} size={17} />
          <Text style={styles.sectionTitle}>Status history</Text>
        </View>
        {history.length ? history.map((step, index) => (
          <View key={`${step.status}-${index}`} style={styles.timelineItem}>
            <CheckCircle2 color={palette(step.status).text} size={16} />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{String(step.status).replace(/_/g, ' ')}</Text>
              <Text style={styles.timelineMeta}>{formatDateTime(step.changedAt)}{step.note ? ` — ${step.note}` : ''}</Text>
            </View>
          </View>
        )) : <Text style={styles.muted}>No status history yet.</Text>}
      </View>

      {/* Order chat */}
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <MessageCircle color={colors.orange} size={17} />
          <Text style={styles.sectionTitle}>Order chat</Text>
        </View>
        {asArray<OrderMessage>(order.messages).length ? asArray<OrderMessage>(order.messages).map((msg, index) => (
          <View key={`${msg.timestamp || index}`} style={[styles.message, msg.senderRole === 'SELLER' && styles.messageSeller]}>
            <Text style={styles.messageRole}>{msg.senderRole}</Text>
            <Text style={styles.messageText}>{msg.content}</Text>
            {msg.quoteAmount ? <Text style={styles.quote}>{money(msg.quoteAmount)}</Text> : null}
            <Text style={styles.messageTime}>{formatDateTime(msg.timestamp)}</Text>
          </View>
        )) : <Text style={styles.muted}>No messages yet.</Text>}
        <View style={styles.composer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Reply to buyer..."
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending || !message.trim()} activeOpacity={0.85}>
            <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connection: { color: '#ffedd5', fontSize: 11, fontWeight: '800' },
  title: { color: colors.card, fontSize: 26, fontWeight: '900' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  buyer: { color: '#ffedd5', fontSize: 12, fontWeight: '700' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 10 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  actionBtn: { height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  actionText: { flex: 1, color: colors.greenDark, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  rowLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  rowValue: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  rowHighlight: { color: colors.greenDark, fontSize: 14 },
  address: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  notes: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  timelineItem: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line, alignItems: 'center' },
  timelineTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  timelineMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  message: { alignSelf: 'flex-start', maxWidth: '88%', borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 },
  messageSeller: { alignSelf: 'flex-end', backgroundColor: colors.orangeSoft, borderColor: colors.orange },
  messageRole: { color: colors.orangeDark, fontSize: 9, fontWeight: '900' },
  messageText: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  quote: { color: colors.greenDark, fontSize: 18, fontWeight: '900', marginTop: 4 },
  messageTime: { color: colors.faint, fontSize: 10, fontWeight: '700' },
  composer: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink },
  sendButton: { width: 72, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
});
