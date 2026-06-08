import React, { useMemo, useState } from 'react';
import {
  Alert, Linking, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, BadgeCheck, Bike, Phone, Search, ShieldCheck, SlidersHorizontal, Star } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { api } from '../src/lib/api';
import { asArray, idOf } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { useRemote } from '../src/hooks/useRemote';

type Rider = {
  _id?: string;
  id?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  plateNumber?: string;
  vehicleType?: string;
  rating?: number;
  reviewCount?: number;
  totalReviews?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
  isApproved?: boolean;
  isActive?: boolean;
  distanceMeters?: number;
  currentLocation?: { lat?: number; lng?: number; updatedAt?: string };
  premiumPlan?: { isActive?: boolean; status?: string; expiresAt?: string };
  personPickupPremium?: boolean;
  userId?: { fullName?: string; phone?: string } | string;
};

const loadRiders = async () => {
  const directory = await api.get<Rider[]>('rider', '/riders/directory', { auth: false }).catch(() => []);
  const riders = asArray<Rider>(directory);
  if (riders.length) return riders;

  const legacy = await api.get<Rider[]>('rider', '/riders?isApproved=true', { auth: false }).catch(() => []);
  return asArray<Rider>(legacy).filter(rider => rider.isApproved !== false);
};

const riderName = (rider: Rider) =>
  rider.fullName || rider.name || (typeof rider.userId === 'object' ? rider.userId.fullName : undefined) || 'Approved rider';

const riderPhone = (rider: Rider) =>
  rider.phone || (typeof rider.userId === 'object' ? rider.userId.phone : undefined);

const isPremium = (rider: Rider) =>
  rider.personPickupPremium || rider.premiumPlan?.isActive || String(rider.premiumPlan?.status || '').toLowerCase() === 'active';

export default function RidersDirectoryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'rating' | 'active' | 'premium'>('rating');
  const { data, loading, refreshing, error, refresh } = useRemote(loadRiders, []);

  const riders = data || [];
  const visibleRiders = useMemo(() => {
    const norm = query.trim().toLowerCase();
    return riders
      .filter(rider => {
        if (!norm) return true;
        return [
          riderName(rider), rider.plateNumber, rider.vehicleType,
          riderPhone(rider),
        ].filter(Boolean).join(' ').toLowerCase().includes(norm);
      })
      .sort((a, b) => {
        if (sort === 'premium') return Number(isPremium(b)) - Number(isPremium(a)) || Number(b.rating || 0) - Number(a.rating || 0);
        if (sort === 'active') return Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) || Number(b.rating || 0) - Number(a.rating || 0);
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
  }, [query, riders, sort]);

  if (loading && !data) return <LoadingBlock label="Loading approved riders..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.85}>
          <ArrowLeft color={colors.ink} size={21} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rider Directory</Text>
          <Text style={styles.subtitle}>Choose an approved rider or request system assignment</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primaryMid} />}
      >
        <View style={styles.searchBox}>
          <Search color={colors.body} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search rider, plate, phone..."
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
          />
          <SlidersHorizontal color={colors.body} size={18} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <SortChip label="Best reviews" active={sort === 'rating'} onPress={() => setSort('rating')} />
          <SortChip label="Online first" active={sort === 'active'} onPress={() => setSort('active')} />
          <SortChip label="Premium pickup" active={sort === 'premium'} onPress={() => setSort('premium')} />
        </ScrollView>

        <View style={styles.infoBanner}>
          <ShieldCheck color={colors.primary} size={18} />
          <Text style={styles.infoText}>
            System pickup keeps escrow and broadcast logic inside RMF. Direct contact is outside platform payment protection.
          </Text>
        </View>

        {visibleRiders.length ? visibleRiders.map(rider => (
          <RiderCard
            key={idOf(rider) || riderName(rider)}
            rider={rider}
            onSystem={() => router.push('/markets' as any)}
            onDirect={() => {
              const phone = riderPhone(rider);
              if (phone) Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Cannot call', 'Your device could not open the phone dialer.'));
              else Alert.alert('No phone listed', 'This rider has no public phone number yet.');
            }}
          />
        )) : (
          <EmptyBlock
            title="No riders visible"
            body="Approved riders will appear here after admin approval."
          />
        )}
      </ScrollView>
    </View>
  );
}

function SortChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RiderCard({ rider, onSystem, onDirect }: { rider: Rider; onSystem: () => void; onDirect: () => void }) {
  const rating = Number(rider.rating || 5);
  const reviews = Number(rider.reviewCount || rider.totalReviews || rider.totalDeliveries || rider.completedDeliveries || 0);
  const premium = isPremium(rider);
  const distanceKm = rider.distanceMeters ? rider.distanceMeters / 1000 : null;

  return (
    <View style={styles.riderCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{riderName(rider).slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.riderBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName} numberOfLines={1}>{riderName(rider)}</Text>
            <Text style={styles.riderMeta} numberOfLines={1}>
              {rider.vehicleType || 'Motorbike'} {rider.plateNumber ? `- ${rider.plateNumber}` : ''}
              {distanceKm !== null ? ` - ${distanceKm.toFixed(1)} km away` : ''}
            </Text>
          </View>
          {premium ? (
            <View style={styles.premiumBadge}>
              <BadgeCheck color={colors.primaryMid} size={13} />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.ratingPill}>
            <Star color={colors.primaryMid} fill={colors.primaryMid} size={13} />
            <Text style={styles.ratingText}>{rating.toFixed(1)} ({reviews})</Text>
          </View>
          <View style={[styles.statusPill, rider.isActive && styles.statusPillActive]}>
            <View style={[styles.statusDot, rider.isActive && styles.statusDotActive]} />
            <Text style={[styles.statusText, rider.isActive && styles.statusTextActive]}>
              {rider.isActive ? 'ONLINE' : 'APPROVED'}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.systemButton} onPress={onSystem} activeOpacity={0.88}>
            <Bike color={colors.primaryDark} size={15} />
            <Text style={styles.systemText}>System pickup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.directButton} onPress={onDirect} activeOpacity={0.88}>
            <Phone color={colors.primary} size={15} />
            <Text style={styles.directText}>Direct call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighest,
  },
  iconButton: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  subtitle: { color: colors.body, fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 2 },
  content: { padding: 16, gap: 10, paddingBottom: 108 },
  searchBox: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700', paddingVertical: 0 },
  filters: { gap: 8 },
  filterChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  filterText: { color: colors.body, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: colors.primaryDark },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: 12,
  },
  infoText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  riderCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: 12,
  },
  avatar: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryFixedDim, fontSize: 17, fontWeight: '900' },
  riderBody: { flex: 1, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  riderName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  riderMeta: { color: colors.body, fontSize: 12, fontWeight: '700', marginTop: 2 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  premiumText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint },
  statusDotActive: { backgroundColor: colors.green },
  statusText: { color: colors.body, fontSize: 10, fontWeight: '900' },
  statusTextActive: { color: colors.greenDark },
  actionRow: { flexDirection: 'row', gap: 8 },
  systemButton: { flex: 1, height: 40, borderRadius: 8, backgroundColor: colors.primaryMid, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  systemText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  directButton: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  directText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
});
