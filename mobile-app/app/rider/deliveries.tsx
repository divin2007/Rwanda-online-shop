import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bike, Camera, CheckCircle2, MapPin } from 'lucide-react-native';
import { MapPreview, coordinatesFromAny } from '../../src/components/MapPreview';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Delivery } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

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

  const accept = async (id: string) => {
    await api.patch('delivery', `/deliveries/${id}/accept`, {});
    refresh();
  };

  const streamLocation = async (id: string) => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Location permission needed', 'Riders must share live location while delivering.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await api.post('delivery', `/deliveries/${id}/location`, { lat: current.coords.latitude, lng: current.coords.longitude });
    refresh();
  };

  const uploadPickupPhoto = async (id: string) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Pickup proof requires a product photo.');
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (photo.canceled || !photo.assets?.[0]) return;
    const asset = photo.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || `pickup-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    } as any);
    const uploaded = await api.post<{ url: string }>('delivery', `/deliveries/${id}/pickup-photo`, form, { formData: true });
    await api.post('delivery', `/deliveries/${id}/pickup`, { photoUrl: uploaded.url, qrData: uploaded.url });
    refresh();
  };

  const complete = async (id: string) => {
    await api.patch('delivery', `/deliveries/${id}/complete`, {});
    refresh();
  };

  if (!isAuthenticated || user?.role !== 'RIDER') {
    return <EmptyBlock title="Rider account required" body="Sign in with an approved rider account to accept and track deliveries." />;
  }
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const active = data?.active;
  const available = data?.available || [];
  const history = data?.history || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.hero}>
        <Bike color={colors.orange} size={26} />
        <Text style={styles.title}>Rider deliveries</Text>
        <Text style={styles.subtitle}>Accept jobs, submit pickup proof, stream location, and complete handover.</Text>
      </View>

      {active ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Active delivery</Text>
          <MapPreview
            title={`Delivery #${active._id.slice(0, 8).toUpperCase()}`}
            points={[
              { label: 'Pickup', tone: 'pickup', coordinates: coordinatesFromAny(active.pickup) },
              { label: 'Drop-off', tone: 'dropoff', coordinates: coordinatesFromAny(active.dropoff) },
              { label: 'Rider', tone: 'rider', coordinates: coordinatesFromAny(active.currentLocation) },
            ]}
          />
          <DeliveryCard delivery={active} />
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.action} onPress={() => uploadPickupPhoto(active._id)}><Camera color={colors.greenDark} size={15} /><Text style={styles.actionText}>Pickup proof</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => streamLocation(active._id)}><MapPin color={colors.greenDark} size={15} /><Text style={styles.actionText}>Share GPS</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => complete(active._id)}><CheckCircle2 color={colors.greenDark} size={15} /><Text style={styles.actionText}>Complete</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Available deliveries</Text>
        {available.length ? available.map(delivery => (
          <View key={delivery._id} style={styles.deliveryWrap}>
            <DeliveryCard delivery={delivery} />
            <TouchableOpacity style={styles.accept} onPress={() => accept(delivery._id)}><Text style={styles.acceptText}>Accept delivery</Text></TouchableOpacity>
          </View>
        )) : <Text style={styles.muted}>No available delivery jobs right now.</Text>}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>History</Text>
        {history.length ? history.slice(0, 10).map(delivery => <DeliveryCard key={delivery._id} delivery={delivery} />) : <Text style={styles.muted}>No completed deliveries returned.</Text>}
      </View>
    </ScrollView>
  );
}

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  return (
    <View style={styles.delivery}>
      <View style={{ flex: 1 }}>
        <Text style={styles.deliveryId}>Delivery #{delivery._id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.deliveryMeta}>{delivery.status || 'pending'}</Text>
      </View>
      <Text style={styles.earnings}>{money(delivery.earnings || delivery.fee)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 8 },
  title: { color: colors.card, fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  deliveryWrap: { gap: 8 },
  delivery: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  deliveryId: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  deliveryMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  earnings: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  actionGrid: { gap: 8 },
  action: { height: 42, borderRadius: 8, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: colors.greenDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  accept: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  muted: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
