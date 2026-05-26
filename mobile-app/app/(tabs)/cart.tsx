import * as Location from 'expo-location';
import React, { useRef, useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Link, useRouter } from 'expo-router';
import { MapPin, Minus, Navigation, Phone, Plus, ShieldCheck, Trash2, X } from 'lucide-react-native';
import { OrderLineCard } from '../../src/components/Cards';
import { PrimaryButton } from '../../src/components/FormControls';
import { EmptyBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { api, serviceUrl } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { buildLeafletStandardLayer } from '../../src/lib/mapTiles';
import { colors } from '../../src/theme';
import { CartItem, Coordinates, Order } from '../../src/types';

type PaymentMethod = 'MTN_MOMO' | 'AIRTEL_MONEY';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const groupBySeller = (items: CartItem[]) =>
  items.reduce<Record<string, CartItem[]>>((groups, item) => {
    groups[item.sellerId] = groups[item.sellerId] || [];
    groups[item.sellerId].push(item);
    return groups;
  }, {});

const idOf = (value: any): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value._id !== undefined) return idOf(value._id);
  if (value.id !== undefined) return idOf(value.id);
  return String(value);
};

const normalizeRwandaPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('2507') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('7') && digits.length === 9) return `0${digits}`;
  return digits;
};

// Build a self-contained Leaflet HTML page that posts picked coordinates back
const buildMapHtml = (initLat: number, initLng: number) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${initLat},${initLng}], 15);
  ${buildLeafletStandardLayer('standardLayer', true)}
  var marker = L.marker([${initLat},${initLng}],{draggable:true}).addTo(map);
  marker.bindPopup('Drag to set delivery pin').openPopup();
  function send(latlng){
    window.ReactNativeWebView.postMessage(JSON.stringify({lat:latlng.lat,lng:latlng.lng}));
  }
  marker.on('dragend',function(e){send(e.target.getLatLng());});
  map.on('click',function(e){marker.setLatLng(e.latlng);send(e.latlng);});
</script>
</body></html>`;

export default function CartScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const [phone, setPhone] = useState(user?.phone || '');
  const [addressText, setAddressText] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MTN_MOMO');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: -1.9441, lng: 30.0619 });
  const [pendingPin, setPendingPin] = useState<Coordinates | null>(null);

  const grouped = useMemo(() => groupBySeller(items), [items]);

  // FIX: Server validates totalAmount = subtotal + deliveryFee only (no gatewayFee on server side)
  // Gateway fee is collected separately by the payment provider — do not include in order totalAmount
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
  const total = subtotal + deliveryFee + gatewayFee;

  // ── Fetch fee using coordinates ──────────────────────────────────────
  const fetchDeliveryFee = async (coords: Coordinates) => {
    const firstWithMarket = items.find(item => item.marketCoordinates);
    if (!firstWithMarket?.marketCoordinates) {
      setDeliveryFee(500); // minimum flat fee when no market coords available
      return;
    }
    try {
      // FIX: API wraps response in { success, data: { fee, route } } — must read .data.fee
      const res = await api.post<{ fee?: number; route?: any } | any>(
        'delivery', '/deliveries/fee',
        { from: firstWithMarket.marketCoordinates, to: coords },
        { auth: false },
      ).catch(() => null);

      // Handle both wrapped envelope and direct response shapes
      const fee = Number(
        res?.fee          // direct shape
        ?? res?.data?.fee // envelope shape (ApiEnvelope strips outer; but double-check)
        ?? 500,
      );
      setDeliveryFee(fee > 0 ? fee : 500);
    } catch {
      setDeliveryFee(500);
    }
  };

  // ── Use GPS current location ─────────────────────────────────────────
  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'RMF needs a delivery pin to calculate rider fees.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: current.coords.latitude, lng: current.coords.longitude };
      setLocation(coords);
      setMapCenter(coords);
      await fetchDeliveryFee(coords);
    } catch (err) {
      Alert.alert('Could not read location', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLocating(false);
    }
  };

  // ── Open map picker ──────────────────────────────────────────────────
  const openMapPicker = async () => {
    // Try to pre-center on GPS without blocking
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch { /* silently use default Kigali center */ }
    setPendingPin(location ?? mapCenter);
    setMapVisible(true);
  };

  const confirmMapPin = async () => {
    if (!pendingPin) return;
    setLocation(pendingPin);
    setMapVisible(false);
    await fetchDeliveryFee(pendingPin);
  };

  // ── Place orders ─────────────────────────────────────────────────────
  const placeOrders = async () => {
    if (!user) { router.push('/(auth)/login'); return; }
    const userId = idOf(user.id || (user as any)._id || (user as any).userId);
    if (!userId) {
      Alert.alert('Session issue', 'Please sign in again before placing this order.');
      return;
    }
    const paymentPhone = normalizeRwandaPhone(phone);
    if (!/^07\d{8}$/.test(paymentPhone)) {
      Alert.alert('Phone required', 'Enter a valid Rwanda mobile money number, for example 078xxxxxxx.');
      return;
    }

    setSubmitting(true);
    try {
      const createdOrders: Order[] = [];
      const sellerGroups = Object.values(grouped);

      for (const sellerItems of sellerGroups) {
        const first = sellerItems[0];
        const groupSubtotal = sellerItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const groupDeliveryFee = sellerGroups.length > 1
          ? Math.ceil(deliveryFee / sellerGroups.length)
          : deliveryFee;

        // FIX: platformCommission must be exactly Math.max(subtotal * 0.015, 100)
        const platformCommission = Math.max(groupSubtotal * 0.015, 100);

        // FIX: Server validates totalAmount = subtotal + deliveryFee ONLY.
        // Do NOT add gatewayFee here — server recalculates and rejects mismatches > 1 RWF.
        const serverTotal = groupSubtotal + groupDeliveryFee;

        const payload = {
          buyer: {
            userId,
            fullName: user.fullName,
            phone: paymentPhone,
            deliveryAddress: location
              ? {
                  address: addressText.trim() || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
                  coordinates: [location.lng, location.lat],
                }
              : addressText.trim()
              ? { address: addressText.trim() }
              : undefined,
          },
          seller: {
            sellerId: first.sellerId,
            userId: first.sellerUserId,
            fullName: first.sellerName,
            stallId: first.stallId,
            marketId: first.marketId,
          },
          products: sellerItems.map(item => ({
            productId: item.productId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            images: item.images,
            attributes: item.attributes,
            variantId: item.variantId,
            variantTitle: item.variantTitle,
            sellerSku: item.sellerSku,
            priceSnapshotAt: new Date().toISOString(),
          })),
          financials: {
            subtotal: groupSubtotal,
            deliveryFee: groupDeliveryFee,
            platformCommission,
            gatewayFee: Math.ceil((groupSubtotal + groupDeliveryFee) * 0.02),
            // FIX: totalAmount must equal subtotal + deliveryFee (server rule line 273-276)
            totalAmount: serverTotal,
            sellerPayout: Math.max(groupSubtotal - platformCommission, 0),
            riderPayout: groupDeliveryFee,
          },
          payment: { method: paymentMethod, status: 'pending' },
          notes,
        };

        const order = await api.post<Order>('order', '/orders', payload);
        if (String(order.payment?.status || '').toLowerCase() === 'failed') {
          throw new Error((order.payment as any)?.errorMessage || 'Payment prompt could not be sent. Confirm the MoMo number and retry.');
        }
        createdOrders.push(order);
      }

      clearCart();
      const firstOrder = createdOrders[0];
      if (firstOrder?._id) router.replace(`/orders/${firstOrder._id}` as any);
      else router.replace('/orders' as any);
    } catch (err) {
      Alert.alert('Checkout failed', err instanceof Error ? err.message : 'The order service rejected this checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <View style={styles.container}>
        <EmptyBlock
          title="Your cart is empty"
          body="Add products from live RMF sellers before checking out."
          actionLabel="Browse products"
          onAction={() => router.push('/' as any)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {!isAuthenticated ? (
          <View style={styles.authCard}>
            <ShieldCheck color={colors.orange} size={18} />
            <Text style={styles.authText}>Sign in before checkout so escrow, notifications, and tracking attach to your RMF account.</Text>
            <Link href="/(auth)/login" asChild><TouchableOpacity><Text style={styles.authLink}>Sign in</Text></TouchableOpacity></Link>
          </View>
        ) : null}

        {/* Items */}
        <View style={styles.panel}>
          <Text style={styles.title}>Review items</Text>
          {items.map(item => (
            <View key={`${item.productId}-${item.variantId || 'base'}`} style={styles.cartLine}>
              <OrderLineCard item={item} />
              <View style={styles.lineActions}>
                <View style={styles.qty}>
                  <TouchableOpacity onPress={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}>
                    <Minus color={colors.ink} size={16} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}>
                    <Plus color={colors.ink} size={16} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(item.productId, item.variantId)} style={styles.remove}>
                  <Trash2 color={colors.danger} size={15} />
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery & Payment */}
        <View style={styles.panel}>
          <Text style={styles.title}>Delivery and payment</Text>

          {/* Location buttons */}
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={[styles.locationBtn, styles.locationBtnGps, location && styles.locationBtnActive]}
              onPress={useCurrentLocation}
              disabled={locating}
              activeOpacity={0.85}
            >
              <Navigation color={location ? colors.card : colors.orange} size={16} />
              <Text style={[styles.locationBtnText, location && styles.locationBtnTextActive]}>
                {locating ? 'Reading GPS…' : 'Current location'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.locationBtn, styles.locationBtnMap]}
              onPress={openMapPicker}
              activeOpacity={0.85}
            >
              <MapPin color={colors.orange} size={16} />
              <Text style={styles.locationBtnText}>Pick on map</Text>
            </TouchableOpacity>
          </View>

          {location ? (
            <View style={styles.pinCard}>
              <MapPin color={colors.orange} size={14} />
              <Text style={styles.pinText}>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </Text>
              <TouchableOpacity onPress={() => { setLocation(null); setDeliveryFee(0); }}>
                <X color={colors.muted} size={14} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.locationHint}>Set a delivery pin to calculate the rider fee.</Text>
          )}

          {/* Address text field — matches web OrderChat deliveryAddress input */}
          <View style={styles.inputWrap}>
            <Text style={styles.label}>Delivery address (optional text)</Text>
            <TextInput
              value={addressText}
              onChangeText={setAddressText}
              placeholder="e.g. Kimironko, near Nakumatt, Gate 3"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Mobile money phone</Text>
            <View style={styles.inputRow}>
              <Phone color={colors.faint} size={16} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="07XXXXXXXX"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.methods}>
            {(['MTN_MOMO', 'AIRTEL_MONEY'] as PaymentMethod[]).map(method => (
              <TouchableOpacity
                key={method}
                style={[styles.method, paymentMethod === method && styles.methodActive]}
                onPress={() => setPaymentMethod(method)}
                activeOpacity={0.85}
              >
                <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                  {method === 'MTN_MOMO' ? 'MTN MoMo' : 'Airtel Money'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Delivery notes for seller or rider"
            placeholderTextColor={colors.faint}
            style={styles.notes}
            multiline
          />
        </View>

        {/* Escrow summary */}
        <View style={styles.panel}>
          <Text style={styles.title}>Escrow summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Products</Text>
            <Text style={styles.summaryValue}>{money(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={[styles.summaryValue, !deliveryFee && styles.summaryMuted]}>
              {deliveryFee > 0 ? money(deliveryFee) : 'Set location to calculate'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Gateway fee (2%)</Text>
            <Text style={styles.summaryValue}>{money(gatewayFee)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>You pay</Text>
            <Text style={styles.totalValue}>{money(total)}</Text>
          </View>
          <Text style={styles.totalNote}>
            Gateway fee collected by payment provider. Order escrow: {money(subtotal + deliveryFee)}.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={`Request payment · ${money(total)}`}
          onPress={placeOrders}
          loading={submitting}
          disabled={submitting || !phone.trim()}
        />
      </View>

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
            source={{ html: buildMapHtml(mapCenter.lat, mapCenter.lng) }}
            javaScriptEnabled
            onMessage={event => {
              try {
                const coords: Coordinates = JSON.parse(event.nativeEvent.data);
                setPendingPin(coords);
              } catch { /* ignore malformed messages */ }
            }}
          />

          {pendingPin && (
            <View style={styles.mapPinInfo}>
              <MapPin color={colors.orange} size={14} />
              <Text style={styles.mapPinText}>
                {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
              </Text>
            </View>
          )}

          <View style={styles.mapFooter}>
            <TouchableOpacity style={styles.mapCancel} onPress={() => setMapVisible(false)}>
              <Text style={styles.mapCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapConfirm, !pendingPin && styles.mapConfirmDisabled]}
              onPress={confirmMapPin}
              disabled={!pendingPin}
            >
              <Text style={styles.mapConfirmText}>Confirm pin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 118, gap: 14 },
  authCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.orangeSoft, borderColor: colors.orange, borderWidth: 1, borderRadius: 12, padding: 12 },
  authText: { flex: 1, color: colors.greenDark, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  authLink: { color: colors.orangeDark, fontSize: 12, fontWeight: '900' },
  panel: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 14 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  cartLine: { gap: 8 },
  lineActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, height: 36 },
  qtyText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  removeText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  // Location
  locationRow: { flexDirection: 'row', gap: 10 },
  locationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  locationBtnGps: {},
  locationBtnMap: {},
  locationBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  locationBtnText: { color: colors.orangeDark, fontSize: 12, fontWeight: '900' },
  locationBtnTextActive: { color: colors.card },
  pinCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.orangeSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  pinText: { flex: 1, color: colors.orangeDark, fontSize: 11, fontWeight: '800' },
  locationHint: { color: colors.faint, fontSize: 11, fontWeight: '700' },
  // Form
  inputWrap: { gap: 7 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  inputRow: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  input: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  methods: { flexDirection: 'row', gap: 10 },
  method: { flex: 1, height: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  methodActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  methodText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  methodTextActive: { color: colors.orangeDark },
  notes: { minHeight: 80, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 12, color: colors.ink, fontSize: 13, textAlignVertical: 'top' },
  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  summaryMuted: { color: colors.faint, fontStyle: 'italic' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  totalValue: { color: colors.orangeDark, fontSize: 18, fontWeight: '900' },
  totalNote: { color: colors.faint, fontSize: 10, fontWeight: '700', lineHeight: 15 },
  // Footer
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, padding: 16, paddingBottom: 24 },
  // Map modal
  mapContainer: { flex: 1, backgroundColor: colors.paper },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card },
  mapTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '900' },
  mapClose: { padding: 4 },
  mapPinInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: colors.orangeSoft, borderTopWidth: 1, borderTopColor: colors.line },
  mapPinText: { color: colors.orangeDark, fontSize: 12, fontWeight: '800' },
  mapFooter: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 30, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  mapCancel: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  mapCancelText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  mapConfirm: { flex: 2, height: 48, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  mapConfirmDisabled: { opacity: 0.45 },
  mapConfirmText: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
});
