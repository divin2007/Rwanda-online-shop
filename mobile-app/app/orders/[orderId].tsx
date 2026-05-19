import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, MapPin, MessageCircle, RefreshCcw, ShieldCheck } from 'lucide-react-native';
import { OrderLineCard } from '../../src/components/Cards';
import { MapPreview, coordinatesFromAny } from '../../src/components/MapPreview';
import { ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Order, OrderMessage } from '../../src/types';
import { useOrderSocket } from '../../src/hooks/useOrderSocket';
import { useRemote } from '../../src/hooks/useRemote';

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { payload, connected } = useOrderSocket(orderId ? `order:${orderId}:status` : undefined);
  const { data: order, loading, refreshing, error, refresh, setData } = useRemote<Order>(
    () => api.get<Order>('order', `/orders/${orderId}`),
    [orderId],
  );

  useEffect(() => {
    if (payload?.order) setData(payload.order);
    else if (payload) refresh();
  }, [payload, refresh, setData]);

  const sendMessage = async () => {
    if (!order || !user || !message.trim()) return;
    setSending(true);
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/messages`, {
        senderId: user.id,
        senderRole: user.role === 'SELLER' ? 'SELLER' : 'BUYER',
        content: message.trim(),
        type: 'TEXT',
      });
      setData(updated);
      setMessage('');
    } catch (err) {
      Alert.alert('Message failed', err instanceof Error ? err.message : 'Unable to send this message.');
    } finally {
      setSending(false);
    }
  };

  const retryPayment = async () => {
    if (!order) return;
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/retry-payment`);
      setData(updated);
    } catch (err) {
      Alert.alert('Payment retry failed', err instanceof Error ? err.message : 'Could not retry payment.');
    }
  };

  const raiseDispute = async () => {
    if (!order) return;
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/dispute`, { reason: 'Mobile buyer requested review.' });
      setData(updated);
    } catch (err) {
      Alert.alert('Dispute failed', err instanceof Error ? err.message : 'Could not raise dispute.');
    }
  };

  if (loading && !order) return <LoadingBlock label="Loading order from escrow service..." />;
  if (error && !order) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!order) return null;

  const lines = asArray<any>(order.products?.length ? order.products : order.product ? [order.product] : []);
  const history = asArray<any>(order.statusHistory);
  const paymentStatus = order.payment?.status || 'pending';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <ShieldCheck color={colors.orange} size={22} />
          <Text style={styles.connection}>{connected ? 'Live updates connected' : 'Live updates reconnecting'}</Text>
        </View>
        <Text style={styles.title}>Order #{shortId(order.orderNumber || order._id)}</Text>
        <View style={styles.status}><Text style={styles.statusText}>{order.status || 'pending'}</Text></View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Escrow status</Text>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment</Text><Text style={styles.summaryValue}>{paymentStatus}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryValue}>{money(order.financials?.totalAmount)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Seller payout</Text><Text style={styles.summaryValue}>{money(order.financials?.sellerPayout)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Rider payout</Text><Text style={styles.summaryValue}>{money(order.financials?.riderPayout)}</Text></View>
        {(paymentStatus === 'failed' || paymentStatus === 'pending') ? (
          <TouchableOpacity style={styles.action} onPress={retryPayment} activeOpacity={0.85}>
            <RefreshCcw color={colors.greenDark} size={16} />
            <Text style={styles.actionText}>Retry payment request</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Items</Text>
        {lines.map((line, index) => <OrderLineCard key={line.productId || index} item={line} />)}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Fulfillment timeline</Text>
        {history.length ? history.map((step, index) => (
          <View key={`${step.status}-${index}`} style={styles.timelineItem}>
            <CheckCircle2 color={colors.orange} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{step.status}</Text>
              <Text style={styles.timelineMeta}>{formatDateTime(step.changedAt)} {step.note ? `- ${step.note}` : ''}</Text>
            </View>
          </View>
        )) : (
          <Text style={styles.muted}>No status history returned for this order.</Text>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <MessageCircle color={colors.orange} size={18} />
          <Text style={styles.sectionTitle}>Order chat</Text>
        </View>
        {asArray<OrderMessage>(order.messages).length ? asArray<OrderMessage>(order.messages).map((msg, index) => (
          <View key={`${msg.timestamp || index}`} style={[styles.message, msg.senderRole === 'SELLER' && styles.messageSeller]}>
            <Text style={styles.messageRole}>{msg.senderRole}</Text>
            <Text style={styles.messageText}>{msg.content}</Text>
            {msg.quoteAmount ? <Text style={styles.quote}>{money(msg.quoteAmount)}</Text> : null}
            <Text style={styles.messageTime}>{formatDateTime(msg.timestamp)}</Text>
          </View>
        )) : (
          <Text style={styles.muted}>No messages yet.</Text>
        )}
        <View style={styles.composer}>
          <TextInput value={message} onChangeText={setMessage} placeholder="Send a message..." placeholderTextColor={colors.faint} style={styles.input} />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending || !message.trim()} activeOpacity={0.85}>
            <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <MapPin color={colors.orange} size={18} />
          <Text style={styles.sectionTitle}>Delivery tracking</Text>
        </View>
        <MapPreview
          title="Pickup, rider, and drop-off"
          points={[
            { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(order.delivery?.pickup || order.delivery?.pickupLocation) },
            { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(order.delivery?.dropoff || order.delivery?.dropoffLocation || order.delivery?.destination) },
            { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(order.delivery?.currentLocation || order.delivery?.riderLocation) },
          ]}
        />
        <Text style={styles.muted}>Pickup proof, QR scan details, and live rider coordinates appear here when the delivery service attaches them to this order.</Text>
      </View>

      <TouchableOpacity style={styles.dispute} onPress={raiseDispute} activeOpacity={0.85}>
        <AlertTriangle color={colors.danger} size={16} />
        <Text style={styles.disputeText}>Request escrow review</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connection: { color: '#ffedd5', fontSize: 11, fontWeight: '800' },
  title: { color: colors.card, fontSize: 27, fontWeight: '900' },
  status: { alignSelf: 'flex-start', backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { color: colors.greenDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  action: { height: 42, borderRadius: 8, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  timelineItem: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
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
  dispute: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disputeText: { color: colors.danger, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});
