import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle, CheckCircle2, MapPin, MessageCircle,
  Package, RefreshCcw, ShieldCheck, Truck, UserCircle, X,
  CreditCard, Phone
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { OrderLineCard } from '../../src/components/Cards';
import { MapPreview, coordinatesFromAny } from '../../src/components/MapPreview';
import { ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { buildLeafletStandardLayer } from '../../src/lib/mapTiles';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Order, OrderMessage, Coordinates } from '../../src/types';
import { useOrderSocket } from '../../src/hooks/useOrderSocket';
import { useRemote } from '../../src/hooks/useRemote';

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  placed: colors.orange,
  confirmed: '#3b82f6',
  preparing: '#f59e0b',
  ready_for_pickup: '#8b5cf6',
  picked_up: '#06b6d4',
  in_transit: '#06b6d4',
  awaiting_confirmation: '#f97316',
  delivered: colors.success ?? '#16a34a',
  cancelled: colors.danger ?? '#dc2626',
  disputed: '#dc2626',
  resolved: '#16a34a',
};
const statusColor = (s?: string) => STATUS_COLORS[String(s || '').toLowerCase()] ?? colors.orange;
const statusBg = (s?: string) => `${statusColor(s)}22`;

const idOf = (value: any): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value._id !== undefined) return idOf(value._id);
  if (value.id !== undefined) return idOf(value.id);
  return String(value);
};

const sameId = (left: any, right: any) => {
  const leftId = idOf(left);
  const rightId = idOf(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

// 5-step escrow milestones (web parity)
type Milestone = { label: string; done: boolean };
const milestones = (order: Order, deliveryData: any): Milestone[] => {
  const s = String(order.status || '').toLowerCase();
  const paid = order.payment?.status === 'paid';
  const ACTIVE = ['confirmed','preparing','ready_for_pickup','picked_up','in_transit','awaiting_confirmation','delivered'];
  const PICKUP_DONE = ['picked_up','in_transit','awaiting_confirmation','delivered'];
  return [
    { label: 'Order placed',           done: true },
    { label: 'Payment secured',        done: paid },
    { label: 'Seller prepares goods',  done: ACTIVE.includes(s) },
    { label: 'Rider QR & photo proof', done: Boolean(deliveryData?.pickup?.pickupPhotoUrl || deliveryData?.pickup?.qrScannedAt) || PICKUP_DONE.includes(s) },
    { label: 'Buyer confirms receipt', done: s === 'delivered' },
  ];
};

const buildNegotiationMapHtml = (initLat: number, initLng: number, marketLat?: number, marketLng?: number) => {
  const hasMarket = typeof marketLat === 'number' && typeof marketLng === 'number';
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background-color:#f7faf8}
  .leaflet-bar { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
  .leaflet-bar a { background-color: #ffffff !important; color: #ff6b00 !important; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${initLat},${initLng}], 14);
  ${buildLeafletStandardLayer('standardLayer', true)}

  var marketIcon = L.divIcon({
    html: '<div style="background-color:#e05300;width:14px;height:14px;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  var pinIcon = L.divIcon({
    html: '<div style="background-color:#2563eb;width:14px;height:14px;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  var marketMarker = null;
  var pinMarker = L.marker([${initLat},${initLng}], {draggable:true, icon:pinIcon}).addTo(map);
  var routeLine = null;

  ${hasMarket ? `
    marketMarker = L.marker([${marketLat},${marketLng}], {icon:marketIcon}).addTo(map);
    marketMarker.bindPopup('Seller Market').openPopup();

    var group = L.featureGroup([marketMarker, pinMarker]);
    map.fitBounds(group.getBounds().pad(0.2));
  ` : ''}

  function fetchRoute() {
    var latlng = pinMarker.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({lat:latlng.lat,lng:latlng.lng}));

    ${hasMarket ? `
      var url = 'https://router.project-osrm.org/route/v1/driving/${marketLng},${marketLat};' + latlng.lng + ',' + latlng.lat + '?overview=full&geometries=geojson';
      fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.code === 'Ok' && data.routes && data.routes[0]) {
            var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
            if (routeLine) {
              routeLine.setLatLngs(coords);
            } else {
              routeLine = L.polyline(coords, {color: '#2563eb', weight: 5, opacity: 0.8}).addTo(map);
            }
          }
        })
        .catch(function(err) {
          var coords = [[${marketLat},${marketLng}], [latlng.lat, latlng.lng]];
          if (routeLine) {
            routeLine.setLatLngs(coords);
          } else {
            routeLine = L.polyline(coords, {color: '#2563eb', weight: 5, opacity: 0.6, dashArray: '5, 10'}).addTo(map);
          }
        });
    ` : ''}
  }

  fetchRoute();

  pinMarker.on('dragend', function(e) { fetchRoute(); });
  map.on('click', function(e) {
    pinMarker.setLatLng(e.latlng);
    fetchRoute();
  });
</script>
</body></html>`;
};

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const userId = idOf(user?.id || (user as any)?._id || (user as any)?.userId);
  const [message, setMessage] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [riderLocation, setRiderLocation] = useState<Coordinates | null>(null);
  const [deliveryData, setDeliveryData] = useState<any>(null);

  // New location change & negotiation states
  const [mapVisible, setMapVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: -1.9441, lng: 30.0619 });
  const [pendingPin, setPendingPin] = useState<Coordinates | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [modalDeliveryFee, setModalDeliveryFee] = useState<number | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [marketCoords, setMarketCoords] = useState<Coordinates | null>(null);

  const { payload, connected } = useOrderSocket(orderId ? `order:${orderId}:status` : undefined);
  const { data: order, loading, refreshing, error, refresh, setData } = useRemote<Order>(
    () => api.get<Order>('order', `/orders/${orderId}`),
    [orderId],
  );

  const deliveryId = order?.deliveryId || (order?.delivery as any)?._id;
  const { payload: trackingPayload } = useOrderSocket(
    deliveryId ? `delivery:${deliveryId}:tracking` : undefined,
    undefined,
    React.useCallback((socket: any) => {
      if (deliveryId) socket.emit('join:delivery', deliveryId);
    }, [deliveryId]),
  );

  // Fetch full delivery data (for rider info + pickup photo)
  useEffect(() => {
    if (!deliveryId) return;
    api.get<any>('delivery', `/deliveries/${deliveryId}`)
      .then(setDeliveryData)
      .catch(() => undefined);
  }, [deliveryId]);

  const mapStatusToIndex = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 0;
      case 'preparing':
        return 1;
      case 'ready_for_pickup':
      case 'picked_up':
        return 2;
      case 'delivered':
      case 'resolved':
        return 3;
      default:
        return 0;
    }
  };

  useEffect(() => {
    if (payload?.order) setData(payload.order);
    else if (payload) refresh();
  }, [payload, refresh, setData]);

  useEffect(() => {
    if (trackingPayload?.lat && trackingPayload?.lng) {
      setRiderLocation({ lat: trackingPayload.lat, lng: trackingPayload.lng });
    }
  }, [trackingPayload]);

  // Fetch seller market coordinates for routing and distance fee calculation
  useEffect(() => {
    if (order?.seller?.marketId) {
      api.get<any>('market', `/markets/${order.seller.marketId}`)
        .then(res => {
          const coords = res?.location?.coordinates || res?.data?.location?.coordinates;
          if (coords && coords.length >= 2) {
            setMarketCoords({ lat: coords[1], lng: coords[0] });
          }
        })
        .catch(() => undefined);
    }
  }, [order?.seller?.marketId]);

  const calculatePreviewFee = async (coords: Coordinates) => {
    if (!marketCoords) return;
    setCalculatingFee(true);
    try {
      const res = await api.post<any>(
        'delivery', '/deliveries/fee',
        { from: marketCoords, to: coords },
        { auth: false }
      );
      const fee = Number(res?.fee ?? res?.data?.fee ?? 500);
      setModalDeliveryFee(fee > 0 ? fee : 500);
    } catch {
      setModalDeliveryFee(500);
    } finally {
      setCalculatingFee(false);
    }
  };

  const openMapPicker = async () => {
    const orderCoords = coordinatesFromAny(order?.buyer?.deliveryAddress);
    const initialCenter = orderCoords || marketCoords || { lat: -1.9441, lng: 30.0619 };
    setMapCenter(initialCenter);
    setPendingPin(orderCoords || initialCenter);
    if (orderCoords) {
      calculatePreviewFee(orderCoords);
    } else if (initialCenter) {
      calculatePreviewFee(initialCenter);
    }
    setMapVisible(true);
  };

  const confirmMapPin = async () => {
    if (!pendingPin || !order || !userId) return;
    setSavingLocation(true);
    try {
      const updated = await api.put<Order>('order', `/orders/${order._id}/delivery-address`, {
        address: `Pin: ${pendingPin.lat.toFixed(5)}, ${pendingPin.lng.toFixed(5)}`,
        coordinates: pendingPin
      });
      setData(updated);
      setMapVisible(false);
      Alert.alert('Location updated', `Delivery fee recalculated and set.`);
    } catch (err) {
      Alert.alert('Failed to update location', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const sendMessage = async () => {
    if (!order || !userId || !message.trim()) return;
    setSending(true);
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/messages`, {
        senderId: userId,
        senderRole: user?.role === 'SELLER' ? 'SELLER' : 'BUYER',
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

  // Confirm receipt — releases escrow (web parity: PUT /orders/:id/status)
  const confirmReceipt = async () => {
    if (!order || !userId) return;
    Alert.alert(
      'Confirm delivery',
      'This releases escrow payment to the seller and rider. Only confirm if goods were received.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, confirm',
          style: 'default',
          onPress: async () => {
            setConfirming(true);
            try {
              const updated = await api.put<Order>('order', `/orders/${order._id}/status`, {
                status: 'delivered',
                userId,
              });
              setData(updated);
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Could not confirm receipt.');
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    );
  };

  const raiseDispute = async () => {
    if (!order || !disputeReason.trim()) {
      Alert.alert('Reason required', 'Please describe your issue before raising a dispute.');
      return;
    }
    try {
      const updated = await api.post<Order>('order', `/orders/${order._id}/dispute`, { reason: disputeReason.trim() });
      setData(updated);
      setShowDisputeForm(false);
      setDisputeReason('');
      Alert.alert('Dispute raised', 'RMF escrow team will review your case.');
    } catch (err) {
      Alert.alert('Dispute failed', err instanceof Error ? err.message : 'Could not raise dispute.');
    }
  };

  if (loading && !order) return <LoadingBlock label="Loading order from escrow service..." />;
  if (error && !order) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!order) return null;

  // Security gate: Ensure user is authorized to view this order
  const isBuyer = sameId(userId, order?.buyer?.userId ?? (order as any)?.buyerId);
  const isSeller = sameId(order?.seller?.userId, userId) || sameId(order?.seller?.sellerId, user?.sellerId);
  const isRider = sameId(order?.delivery?.riderId, user?.riderId) || sameId(deliveryData?.riderId, user?.riderId);
  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin && !isBuyer && !isSeller && !isRider) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.card, padding: 28, borderRadius: 24, alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.divider }}>
          <AlertTriangle color={colors.danger} size={48} />
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Access Denied</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>
            Security warning: You do not have authorization to view this order transaction record.
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 12, height: 46, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/orders' as any)}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Back to My Orders</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const lines = asArray<any>(order.products?.length ? order.products : order.product ? [order.product] : []);
  const history = asArray<any>(order.statusHistory);
  const paymentStatus = order.payment?.status || 'pending';
  const status = String(order.status || 'placed').toLowerCase();
  const canPickLocation = isBuyer && (
    ['awaiting_quote', 'quote_sent'].includes(status) ||
    (status === 'placed' && paymentStatus !== 'paid')
  );
  const showConfirmReceipt = status === 'awaiting_confirmation' && isBuyer;
  const showPaymentBtn = paymentStatus !== 'paid' && status !== 'cancelled' && status !== 'delivered' && isBuyer;
  const showDispute = status === 'delivered' || status === 'awaiting_confirmation';
  const isAlreadyDisputed = status === 'disputed';
  const steps = milestones(order, deliveryData);
  const rider = deliveryData?.rider;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <ShieldCheck color={colors.orange} size={22} />
          <Text style={styles.connection}>{connected ? 'Live updates connected' : 'Reconnecting...'}</Text>
        </View>
        <Text style={styles.title}>Order #{shortId(order.orderNumber || order._id)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusBg(order.status) }]}>
          <Text style={[styles.statusText, { color: statusColor(order.status) }]}>
            {String(order.status || 'placed').replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* ── Confirm Receipt (Escrow Release) ─────────────────── */}
      {showConfirmReceipt && (
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={confirmReceipt}
          disabled={confirming}
          activeOpacity={0.88}
        >
          <Package color={colors.greenDark} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.confirmTitle}>Package arrived?</Text>
            <Text style={styles.confirmSub}>Tap to inspect and confirm receipt — this releases escrow.</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Escrow 5-Step Progress ────────────────────────────── */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Escrow procedure</Text>
        <View style={styles.milestones}>
          {steps.map((step, i) => (
            <View key={i} style={styles.milestone}>
              <View style={[styles.milestoneIcon, step.done && styles.milestoneIconDone]}>
                {step.done
                  ? <CheckCircle2 color={colors.orange} size={14} />
                  : <View style={styles.milestoneEmpty} />}
              </View>
              <Text style={[styles.milestoneText, !step.done && styles.milestoneTextMuted]} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment</Text><Text style={[styles.summaryValue, { color: statusColor(paymentStatus) }]}>{paymentStatus}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryValue}>{money(order.financials?.totalAmount)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Seller payout</Text><Text style={styles.summaryValue}>{money(order.financials?.sellerPayout)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Rider payout</Text><Text style={styles.summaryValue}>{money(order.financials?.riderPayout)}</Text></View>

        {showPaymentBtn && (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: colors.orange, marginTop: 12 }]}
            onPress={retryPayment}
            activeOpacity={0.85}
          >
            <CreditCard color={colors.greenDark} size={16} />
            <Text style={styles.actionText}>Pay with MTN MoMo ({money(order.financials?.totalAmount)})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Items ────────────────────────────────────────────── */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Items</Text>
        {lines.map((line, index) => <OrderLineCard key={line.productId || index} item={line} />)}
      </View>

      {/* ── Rider info ───────────────────────────────────────── */}
      {rider && (
        <View style={[styles.panel, styles.riderCard]}>
          <Truck color={colors.orange} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{rider.fullName || 'Your rider'}</Text>
            {rider.plateNumber ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Truck color={colors.muted} size={12} />
                <Text style={styles.riderMeta}>Plate: {rider.plateNumber}</Text>
              </View>
            ) : null}
            {rider.phone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Phone color={colors.muted} size={12} />
                <Text style={styles.riderMeta}>Phone: {rider.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* ── Delivery address negotiation panel ── */}
      {canPickLocation && (
        <View style={styles.panel}>
          <View style={styles.panelTitleRow}>
            <MapPin color={colors.orange} size={18} />
            <Text style={styles.sectionTitle}>Delivery address</Text>
          </View>
          {order.buyer?.deliveryAddress?.address ? (
            <View style={styles.pinCard}>
              <MapPin color={colors.orange} size={14} />
              <Text style={styles.pinText} numberOfLines={2}>
                {order.buyer.deliveryAddress.address}
              </Text>
            </View>
          ) : (
            <Text style={styles.locationHint}>No delivery pin dropped yet.</Text>
          )}
          <TouchableOpacity
            style={styles.action}
            onPress={openMapPicker}
            activeOpacity={0.85}
          >
            <MapPin color={colors.greenDark} size={16} />
            <Text style={styles.actionText}>
              {order.buyer?.deliveryAddress?.coordinates ? 'Change delivery location' : 'Set delivery location'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Delivery tracking map ─────────────────────────────── */}
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <MapPin color={colors.orange} size={18} />
          <Text style={styles.sectionTitle}>Delivery tracking</Text>
        </View>
        <MapPreview
          title="Pickup, rider, and drop-off"
          points={[
            { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(order.delivery?.pickup || deliveryData?.pickup) },
            { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(order.buyer?.deliveryAddress || order.delivery?.dropoff || deliveryData?.dropoff) },
            { label: 'Rider', tone: 'rider', coordinates: riderLocation || coordinatesFromAny(deliveryData?.currentLocation) },
          ]}
        />
      </View>

      {/* ── Status timeline ───────────────────────────────────── */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Fulfillment timeline</Text>
        {history.length ? history.map((step, index) => (
          <View key={`${step.status}-${index}`} style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: statusColor(step.status) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{String(step.status).replace(/_/g, ' ')}</Text>
              <Text style={styles.timelineMeta}>{formatDateTime(step.changedAt)}{step.note ? ` — ${step.note}` : ''}</Text>
            </View>
          </View>
        )) : (
          <Text style={styles.muted}>No status history returned for this order.</Text>
        )}
      </View>

      {/* ── Order chat ────────────────────────────────────────── */}
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

      {/* ── Dispute ───────────────────────────────────────────── */}
      {showDispute && (
        <View style={styles.panel}>
          <View style={styles.panelTitleRow}>
            <AlertTriangle color={colors.danger} size={18} />
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>Request escrow review</Text>
          </View>
          {isAlreadyDisputed ? (
            <View style={styles.disputedBanner}>
              <Text style={styles.disputedText}>Dispute raised — RMF escrow team is reviewing your case.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.muted}>Describe the issue before submitting. Disputes must be raised within 24 hours of delivery.</Text>
              {showDisputeForm ? (
                <>
                  <TextInput
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                    placeholder="Describe the problem in detail..."
                    placeholderTextColor={colors.faint}
                    style={styles.disputeInput}
                    multiline
                    numberOfLines={4}
                  />
                  <TouchableOpacity style={styles.disputeSubmit} onPress={raiseDispute} activeOpacity={0.85}>
                    <Text style={styles.disputeSubmitText}>Submit dispute</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowDisputeForm(false)}>
                    <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.dispute} onPress={() => setShowDisputeForm(true)} activeOpacity={0.85}>
                  <AlertTriangle color={colors.danger} size={16} />
                  <Text style={styles.disputeText}>Open dispute form</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>

    {/* ── Map Pin Picker Modal ─────────────────────────────── */}
    <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Drag pin or tap to set delivery location</Text>
          <TouchableOpacity onPress={() => setMapVisible(false)} style={styles.mapClose}>
            <X color={colors.ink} size={20} />
          </TouchableOpacity>
        </View>

        <WebView
          style={{ flex: 1 }}
          source={{ html: buildNegotiationMapHtml(mapCenter.lat, mapCenter.lng, marketCoords?.lat, marketCoords?.lng) }}
          javaScriptEnabled
          onMessage={event => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.lat && data.lng) {
                const coords = { lat: data.lat, lng: data.lng };
                setPendingPin(coords);
                calculatePreviewFee(coords);
              }
            } catch { /* ignore */ }
          }}
        />

        <View style={styles.mapPinInfo}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin color={colors.orange} size={14} />
              {pendingPin ? (
                <Text style={styles.mapPinText}>
                  {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
                </Text>
              ) : (
                <Text style={styles.mapPinText}>Loading...</Text>
              )}
            </View>
            {modalDeliveryFee !== null && (
              <Text style={{ color: colors.orangeDark, fontSize: 13, fontWeight: '900' }}>
                Delivery fee: {money(modalDeliveryFee)}
              </Text>
            )}
          </View>
          {calculatingFee && <ActivityIndicator size="small" color={colors.orange} />}
        </View>

        <View style={styles.mapFooter}>
          <TouchableOpacity style={styles.mapCancel} onPress={() => setMapVisible(false)}>
            <Text style={styles.mapCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapConfirm, (!pendingPin || savingLocation) && styles.mapConfirmDisabled]}
            onPress={confirmMapPin}
            disabled={!pendingPin || savingLocation}
          >
            <Text style={styles.mapConfirmText}>
              {savingLocation ? 'Saving...' : 'Confirm pin'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  // Hero
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connection: { color: '#ffedd5', fontSize: 11, fontWeight: '800' },
  title: { color: colors.card, fontSize: 27, fontWeight: '900' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  // Confirm receipt
  confirmBtn: {
    backgroundColor: colors.orange, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: colors.orange, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  confirmTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '900' },
  confirmSub: { color: colors.greenDark, fontSize: 12, lineHeight: 17, fontWeight: '700', opacity: 0.8, marginTop: 2 },
  // Milestones
  milestones: { flexDirection: 'row', gap: 4 },
  milestone: { flex: 1, alignItems: 'center', gap: 6 },
  milestoneIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  milestoneIconDone: { backgroundColor: colors.orangeSoft, borderColor: colors.orange },
  milestoneEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  milestoneText: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'center', lineHeight: 12 },
  milestoneTextMuted: { color: colors.faint },
  // Panel
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  action: { height: 42, borderRadius: 8, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  // Rider
  riderCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  riderMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  // Timeline
  timelineItem: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  timelineMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  // Chat
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
  // Dispute
  dispute: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fff7f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disputeText: { color: colors.danger, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  disputeInput: { minHeight: 90, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 12, color: colors.ink, fontSize: 13, textAlignVertical: 'top' },
  disputeSubmit: { height: 44, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  disputeSubmitText: { color: colors.card, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  disputedBanner: { backgroundColor: '#fff7f7', borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', padding: 12 },
  disputedText: { color: colors.danger, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  // Map Pin Modal styling
  mapContainer: { flex: 1, backgroundColor: colors.paper },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card },
  mapTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '900' },
  mapClose: { padding: 4 },
  mapPinInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.orangeSoft, borderTopWidth: 1, borderTopColor: colors.line },
  mapPinText: { color: colors.orangeDark, fontSize: 12, fontWeight: '800' },
  mapFooter: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 30, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  mapCancel: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  mapCancelText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  mapConfirm: { flex: 2, height: 48, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  mapConfirmDisabled: { opacity: 0.45 },
  mapConfirmText: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  pinCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.orangeSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginVertical: 4 },
  pinText: { flex: 1, color: colors.orangeDark, fontSize: 11, fontWeight: '800' },
  locationHint: { color: colors.faint, fontSize: 11, fontWeight: '700', marginVertical: 4 },
});
