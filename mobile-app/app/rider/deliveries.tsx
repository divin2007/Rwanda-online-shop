import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import {
  Bike, Camera, CheckCircle2, MapPin, Package,
  ShieldCheck, ThumbsDown, Truck, X,
} from 'lucide-react-native';
import { MapPreview, coordinatesFromAny } from '../../src/components/MapPreview';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, shortId } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Delivery } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

// Delivery fee from financials (matches web which uses financials.deliveryFee)
const deliveryFee = (d: Delivery): number =>
  (d as any).financials?.deliveryFee
  ?? (d as any).financials?.baseDeliveryFee
  ?? (d as any).earnings
  ?? (d as any).fee
  ?? 0;

type RiderPayload = {
  active: Delivery | null;
  available: Delivery[];
  history: Delivery[];
};

export default function RiderDeliveriesScreen() {
  const { user, isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh } = useRemote<RiderPayload>(async () => {
    if (!isAuthenticated) return { active: null, available: [], history: [] };
    const [active, available, history] = await Promise.all([
      api.get<Delivery | null>('delivery', '/deliveries/active').catch(() => null),
      api.get<Delivery[]>('delivery', '/deliveries/available').catch(() => []),
      api.get<Delivery[]>('delivery', '/deliveries/history').catch(() => []),
    ]);
    return { active, available: asArray(available), history: asArray(history) };
  }, [isAuthenticated]);

  const active = data?.active;

  // Background GPS stream while delivery is active (matches web rider tracking)
  React.useEffect(() => {
    if (!active || !isAuthenticated) return;
    let subscription: Location.LocationSubscription | null = null;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 },
        async (loc) => {
          if (!mounted) return;
          await api.post('delivery', `/deliveries/${active._id}/location`, {
            lat: loc.coords.latitude, lng: loc.coords.longitude,
          }).catch(() => undefined);
        },
      );
    })();
    return () => { mounted = false; subscription?.remove(); };
  }, [active?._id, isAuthenticated]);

  // Accept delivery
  const accept = async (id: string) => {
    try {
      await api.patch('delivery', `/deliveries/${id}/accept`, {});
      refresh();
    } catch (err) {
      Alert.alert('Accept failed', err instanceof Error ? err.message : 'Could not accept delivery.');
    }
  };

  // Reject delivery (matches web "Reject" button)
  const reject = async (id: string) => {
    Alert.alert('Reject delivery', 'This will make the delivery available to other riders.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch('delivery', `/deliveries/${id}/reject`, {});
            refresh();
          } catch (err) {
            Alert.alert('Reject failed', err instanceof Error ? err.message : 'Could not reject delivery.');
          }
        },
      },
    ]);
  };

  // Upload pickup photo + call scan-qr (matches web: ImageUpload → POST /scan-qr)
  const uploadPickupPhoto = async (id: string, stallId: string) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Pickup proof requires a product photo.');
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (photo.canceled || !photo.assets?.[0]) return;
    const asset = photo.assets[0];

    try {
      // Step 1: Upload photo
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: `pickup-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      const uploaded = await api.post<{ url: string }>('delivery', `${`/deliveries/${id}/pickup-photo`}`, form, { formData: true });

      // Step 2: Call scan-qr with stallId + photoUrl (matches web endpoint exactly)
      await api.post('delivery', `/deliveries/${id}/scan-qr`, {
        stallId: stallId || 'STALL-001',
        photoUrl: uploaded.url,
      });
      Alert.alert('Pickup verified', 'Photo evidence and QR scan recorded.');
      refresh();
    } catch (err) {
      Alert.alert('Pickup verification failed', err instanceof Error ? err.message : 'Could not verify pickup.');
    }
  };

  // Confirm handover (for pending_handover status — matches web "Confirm Item Handover")
  const confirmHandover = async (id: string) => {
    try {
      await api.post('delivery', `/deliveries/${id}/handover`, { role: 'rider' });
      refresh();
    } catch (err) {
      Alert.alert('Handover failed', err instanceof Error ? err.message : 'Could not confirm handover.');
    }
  };

  // Complete delivery (mark as delivered)
  const complete = async (id: string) => {
    Alert.alert('Mark as delivered?', 'Confirm the buyer received their goods.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await api.patch('delivery', `/deliveries/${id}/complete`, {});
            refresh();
          } catch (err) {
            Alert.alert('Complete failed', err instanceof Error ? err.message : 'Could not complete delivery.');
          }
        },
      },
    ]);
  };

  if (!isAuthenticated || user?.role !== 'RIDER') {
    return <EmptyBlock title="Rider account required" body="Sign in with an approved rider account to accept and track deliveries." />;
  }
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const available = data?.available || [];
  const history = data?.history || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Bike color={colors.orange} size={26} />
        <Text style={styles.title}>Rider deliveries</Text>
        <Text style={styles.subtitle}>Accept jobs, submit pickup proof, and complete handover.</Text>
      </View>

      {/* Active delivery */}
      {active ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <ShieldCheck color={colors.orange} size={18} />
            <Text style={styles.sectionTitle}>Active delivery</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#ecfeff' }]}>
              <Text style={[styles.statusText, { color: '#0891b2' }]}>{String(active.status || 'active').replace(/_/g, ' ')}</Text>
            </View>
          </View>

          {/* Fee highlight */}
          <View style={styles.feeCard}>
            <Text style={styles.feeLabel}>Your earning</Text>
            <Text style={styles.feeAmount}>{money(deliveryFee(active))}</Text>
          </View>

          {/* Route info */}
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <Package color={colors.orange} size={14} />
              <Text style={styles.routeText} numberOfLines={2}>
                {(active as any).pickup?.address || 'Market pickup'}
              </Text>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <MapPin color='#dc2626' size={14} />
              <Text style={styles.routeText} numberOfLines={2}>
                {(active as any).dropoff?.address || 'Customer location'}
              </Text>
            </View>
          </View>

          <MapPreview
            title={`Delivery #${shortId(active._id)}`}
            points={[
              { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny((active as any).pickup) },
              { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny((active as any).dropoff) },
              { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny((active as any).currentLocation) },
            ]}
          />

          {/* Status-based action buttons (matches web exactly) */}
          <View style={styles.actionGrid}>
            {(active.status as string) === 'en_route_to_pickup' && (
              <TouchableOpacity
                style={styles.action}
                onPress={() => uploadPickupPhoto(active._id, (active as any).pickup?.stallId || 'STALL-001')}
              >
                <Camera color={colors.greenDark} size={15} />
                <Text style={styles.actionText}>Photo + QR Verify Pickup</Text>
              </TouchableOpacity>
            )}
            {(active.status as string) === 'pending_handover' && (
              <TouchableOpacity style={styles.action} onPress={() => confirmHandover(active._id)}>
                <CheckCircle2 color={colors.greenDark} size={15} />
                <Text style={styles.actionText}>Confirm Item Handover</Text>
              </TouchableOpacity>
            )}
            {(active.status as string) === 'picked_up' && (
              <TouchableOpacity style={[styles.action, { backgroundColor: '#16a34a' }]} onPress={() => complete(active._id)}>
                <CheckCircle2 color={colors.card} size={15} />
                <Text style={[styles.actionText, { color: colors.card }]}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.gpsBtn} onPress={async () => {
              const perm = await Location.requestForegroundPermissionsAsync();
              if (perm.status !== 'granted') return;
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              await api.post('delivery', `/deliveries/${active._id}/location`, {
                lat: loc.coords.latitude, lng: loc.coords.longitude,
              });
              Alert.alert('Location updated', 'Your GPS was sent to the tracking system.');
            }}>
              <MapPin color={colors.orangeDark} size={14} />
              <Text style={styles.gpsBtnText}>Share GPS now</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noActiveCard}>
          <Bike color={colors.faint} size={28} />
          <Text style={styles.noActiveText}>No active delivery. Accept a job below.</Text>
        </View>
      )}

      {/* Available deliveries */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Available deliveries ({available.length})</Text>
        {available.length ? available.map(delivery => (
          <View key={delivery._id} style={styles.deliveryWrap}>
            {/* Fee card */}
            <View style={styles.availCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryId}>Delivery #{shortId(delivery._id)}</Text>
                <View style={styles.routeRow}>
                  <Package color={colors.orange} size={12} />
                  <Text style={styles.deliveryAddress} numberOfLines={1}>
                    {(delivery as any).pickup?.address || 'Market area'}
                  </Text>
                </View>
                <View style={styles.routeRow}>
                  <MapPin color='#dc2626' size={12} />
                  <Text style={styles.deliveryAddress} numberOfLines={1}>
                    {(delivery as any).dropoff?.address || 'Customer location'}
                  </Text>
                </View>
              </View>
              <View style={styles.feeTag}>
                <Text style={styles.feeTagAmount}>{money(deliveryFee(delivery))}</Text>
                <Text style={styles.feeTagLabel}>Fee</Text>
              </View>
            </View>
            <View style={styles.deliveryActions}>
              <TouchableOpacity style={styles.accept} onPress={() => accept(delivery._id)} activeOpacity={0.85}>
                <CheckCircle2 color={colors.orangeDark} size={14} />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(delivery._id)} activeOpacity={0.85}>
                <X color={colors.danger} size={14} />
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )) : <Text style={styles.muted}>No available delivery jobs right now. Pull down to refresh.</Text>}
      </View>

      {/* History */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Completed deliveries</Text>
        {history.length ? history.slice(0, 10).map(delivery => (
          <View key={delivery._id} style={styles.historyRow}>
            <Truck color={colors.orange} size={14} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deliveryId}>#{shortId(delivery._id)}</Text>
              <Text style={styles.deliveryMeta}>{formatDateTime((delivery as any).dropoff?.deliveredAt || (delivery as any).createdAt)}</Text>
            </View>
            <Text style={styles.historyEarning}>{money(deliveryFee(delivery))}</Text>
          </View>
        )) : <Text style={styles.muted}>No completed deliveries yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 8 },
  title: { color: colors.card, fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '900' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  // Fee
  feeCard: { backgroundColor: colors.greenDark, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { color: '#ffedd5', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  feeAmount: { color: colors.orange, fontSize: 22, fontWeight: '900' },
  // Route
  routeCard: { backgroundColor: colors.paper, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  routeDivider: { height: 1, backgroundColor: colors.line, marginVertical: 4, marginLeft: 22 },
  // Actions
  actionGrid: { gap: 8 },
  action: { height: 46, borderRadius: 10, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  gpsBtn: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  gpsBtnText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900' },
  // No active
  noActiveCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: 'center', gap: 10 },
  noActiveText: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  // Available cards
  deliveryWrap: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 14, gap: 10 },
  availCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  deliveryId: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  deliveryAddress: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: '700' },
  feeTag: { backgroundColor: colors.orangeSoft, borderRadius: 8, padding: 10, alignItems: 'center', minWidth: 70 },
  feeTagAmount: { color: colors.orangeDark, fontSize: 15, fontWeight: '900' },
  feeTagLabel: { color: colors.orange, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  deliveryActions: { flexDirection: 'row', gap: 10 },
  accept: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  rejectBtn: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fff7f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rejectText: { color: colors.danger, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  deliveryMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  historyEarning: { color: '#16a34a', fontSize: 12, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
