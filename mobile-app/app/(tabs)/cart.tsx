import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MapPin, Minus, Phone, Plus, ShieldCheck, Trash2 } from 'lucide-react-native';
import { OrderLineCard } from '../../src/components/Cards';
import { PrimaryButton } from '../../src/components/FormControls';
import { EmptyBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { colors } from '../../src/theme';
import { CartItem, Coordinates, Order } from '../../src/types';

type PaymentMethod = 'MTN_MOMO' | 'AIRTEL_MONEY';

const groupBySeller = (items: CartItem[]) => {
  return items.reduce<Record<string, CartItem[]>>((groups, item) => {
    groups[item.sellerId] = groups[item.sellerId] || [];
    groups[item.sellerId].push(item);
    return groups;
  }, {});
};

export default function CartScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MTN_MOMO');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => groupBySeller(items), [items]);
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
  const total = subtotal + deliveryFee + gatewayFee;

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

      const firstWithMarket = items.find(item => item.marketCoordinates);
      if (firstWithMarket?.marketCoordinates) {
        const fee = await api.post<{ fee?: number; totalFee?: number }>('delivery', '/deliveries/fee', {
          from: firstWithMarket.marketCoordinates,
          to: coords,
        }, { auth: false }).catch(() => null);
        setDeliveryFee(Number(fee?.fee ?? fee?.totalFee ?? 0));
      }
    } catch (err) {
      Alert.alert('Could not set delivery pin', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const placeOrders = async () => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Add the mobile money number for payment authorization.');
      return;
    }

    setSubmitting(true);
    try {
      const createdOrders: Order[] = [];
      const sellerGroups = Object.values(grouped);
      for (const sellerItems of sellerGroups) {
        const first = sellerItems[0];
        const groupSubtotal = sellerItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const groupDeliveryFee = sellerGroups.length > 1 ? Math.ceil(deliveryFee / sellerGroups.length) : deliveryFee;
        const groupGatewayFee = Math.ceil((groupSubtotal + groupDeliveryFee) * 0.02);
        const platformCommission = Math.max(groupSubtotal * 0.015, 100);

        const payload = {
          buyer: {
            userId: user.id,
            fullName: user.fullName,
            phone,
            deliveryAddress: location
              ? { address: 'Mobile pinned location', coordinates: [location.lng, location.lat] }
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
            gatewayFee: groupGatewayFee,
            totalAmount: groupSubtotal + groupDeliveryFee + groupGatewayFee,
            sellerPayout: Math.max(groupSubtotal - platformCommission, 0),
            riderPayout: groupDeliveryFee,
          },
          payment: { method: paymentMethod, status: 'pending' },
          notes,
        };

        const order = await api.post<Order>('order', '/orders', payload);
        createdOrders.push(order);
      }

      clearCart();
      const firstOrder = createdOrders[0];
      if (firstOrder?._id) router.replace(`/orders/${firstOrder._id}`);
      else router.replace('/orders');
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
          onAction={() => router.push('/')}
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

        <View style={styles.panel}>
          <Text style={styles.title}>Review items</Text>
          {items.map(item => (
            <View key={`${item.productId}-${item.variantId || 'base'}`} style={styles.cartLine}>
              <OrderLineCard item={item} />
              <View style={styles.lineActions}>
                <View style={styles.qty}>
                  <TouchableOpacity onPress={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}><Minus color={colors.ink} size={16} /></TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}><Plus color={colors.ink} size={16} /></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(item.productId, item.variantId)} style={styles.remove}>
                  <Trash2 color={colors.danger} size={15} />
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.title}>Delivery and payment</Text>
          <TouchableOpacity style={[styles.locationButton, location && styles.locationButtonActive]} onPress={useCurrentLocation} disabled={locating} activeOpacity={0.85}>
            <MapPin color={colors.orange} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>{location ? 'Delivery pin set' : 'Use current delivery location'}</Text>
              <Text style={styles.locationMeta}>
                {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : locating ? 'Reading device location...' : 'Calculates live rider fee when seller coordinates are available.'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Mobile money phone</Text>
            <View style={styles.inputRow}>
              <Phone color={colors.faint} size={16} />
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XXXXXXXX" placeholderTextColor={colors.faint} style={styles.input} />
            </View>
          </View>

          <View style={styles.methods}>
            {(['MTN_MOMO', 'AIRTEL_MONEY'] as PaymentMethod[]).map(method => (
              <TouchableOpacity key={method} style={[styles.method, paymentMethod === method && styles.methodActive]} onPress={() => setPaymentMethod(method)} activeOpacity={0.85}>
                <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>{method === 'MTN_MOMO' ? 'MTN MoMo' : 'Airtel Money'}</Text>
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

        <View style={styles.panel}>
          <Text style={styles.title}>Escrow summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Products</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery fee</Text><Text style={styles.summaryValue}>{money(deliveryFee)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Gateway fee</Text><Text style={styles.summaryValue}>{money(gatewayFee)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{money(total)}</Text></View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Request payment" onPress={placeOrders} loading={submitting} disabled={submitting || !phone.trim()} />
      </View>
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
  locationButton: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: colors.paper },
  locationButtonActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  locationTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  locationMeta: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  totalValue: { color: colors.orangeDark, fontSize: 18, fontWeight: '900' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, padding: 16, paddingBottom: 24 },
});

