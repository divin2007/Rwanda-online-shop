import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, List, Map, MapPin, Search, SlidersHorizontal, Star } from 'lucide-react-native';
import { FastImage } from '../../src/components/FastImage';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { asArray, idOf, normalizeMarketImageUrl } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Market } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

const fallbackImages = [
  'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1564429097439-e400382dc893?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=500&auto=format&fit=crop&q=80',
];

const loadMarkets = async (): Promise<Market[]> => {
  const markets = await api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false });
  return asArray<Market>(markets);
};

const hubType = (market?: Market) => market?.type || 'Retail';

const marketImage = (market: Market, index: number) =>
  normalizeMarketImageUrl(market.imageUrl) || fallbackImages[index % fallbackImages.length];

export default function MarketsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const [query, setQuery] = useState(String(params.search || ''));
  const [marketType, setMarketType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const { data, loading, refreshing, error, refresh } = useRemote(loadMarkets, []);

  useEffect(() => {
    setQuery(String(params.search || ''));
  }, [params.search]);

  const markets = data || [];
  const marketTypes = useMemo(() => {
    const dynamic = Array.from(new Set(markets.map(hubType).filter(Boolean)));
    return dynamic.length ? dynamic : ['Wholesale', 'Retail', 'Produce', 'Textiles'];
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const norm = query.trim().toLowerCase();
    return markets
      .filter(m => !marketType || hubType(m) === marketType)
      .filter(m => {
        if (!norm) return true;
        return [
          m.name, m.code, m.type, m.description,
          m.location?.district, m.location?.sector, m.location?.address,
        ].filter(Boolean).join(' ').toLowerCase().includes(norm);
      })
      .sort((a, b) => {
        const left = Number(a.rating || 0) * 100 + Number(a.totalSellers || 0);
        const right = Number(b.rating || 0) * 100 + Number(b.totalSellers || 0);
        return right - left;
      });
  }, [markets, marketType, query]);

  if (loading && !data) return <LoadingBlock label="Loading market hubs..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primaryMid} />}
    >
      <View style={styles.stickyHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Hub Explorer</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.8}
            >
              <List color={viewMode === 'list' ? colors.ink : colors.body} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'map' && styles.viewButtonActive]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.8}
            >
              <Map color={viewMode === 'map' ? colors.ink : colors.body} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search color={colors.body} size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search markets, hubs, commodities..."
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            style={styles.searchInput}
          />
          <SlidersHorizontal color={colors.body} size={20} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <HubChip label="All Hubs" active={!marketType} onPress={() => setMarketType(null)} />
          {marketTypes.map(type => (
            <HubChip key={type} label={type} active={marketType === type} onPress={() => setMarketType(type)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.metricRow}>
        <Text style={styles.metricText}>
          Showing <Text style={styles.metricValue}>{filteredMarkets.length}</Text> active hubs
        </Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE DATA</Text>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapCard}>
          <View style={styles.mapCanvas}>
            {filteredMarkets.slice(0, 8).map((market, index) => (
              <View
                key={idOf(market) || `${market.name}-${index}`}
                style={[
                  styles.mapPin,
                  { left: `${14 + ((index * 23) % 68)}%`, top: `${18 + ((index * 17) % 58)}%` },
                ]}
              />
            ))}
          </View>
          <View style={styles.mapFooter}>
            <MapPin color={colors.primaryMid} size={16} />
            <Text style={styles.mapText}>Kigali hub density preview</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.hubList}>
        {filteredMarkets.length ? filteredMarkets.map((market, index) => (
          <HubCard
            key={idOf(market) || `${market.name}-${index}`}
            market={market}
            image={marketImage(market, index)}
            index={index}
            onPress={() => {
              const marketId = idOf(market);
              if (marketId) router.push(`/market/${marketId}` as any);
            }}
          />
        )) : (
          <EmptyBlock
            title="No hubs found"
            body="Change your search or clear the hub filter."
            actionLabel="Clear filters"
            onAction={() => { setQuery(''); setMarketType(null); }}
          />
        )}
      </View>
    </ScrollView>
  );
}

function HubChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function HubCard({ market, image, index, onPress }: { market: Market; image: string; index: number; onPress: () => void }) {
  const district = market.location?.district || market.location?.sector || 'Kigali City Hub';
  const promo = index % 3 === 2 ? 'OPEN' : `-${(8 + index * 2.5).toFixed(1)}%`;

  return (
    <TouchableOpacity style={styles.hubCard} onPress={onPress} activeOpacity={0.9}>
      <FastImage uri={image} style={styles.hubImage} fallback={<View style={styles.imageFallback}><Text style={styles.imageInitial}>{market.name?.charAt(0) || 'H'}</Text></View>} />
      <View style={styles.verifiedBadge}>
        <CheckCircle2 color={colors.primaryMid} size={13} />
      </View>

      <View style={styles.hubBody}>
        <View>
          <Text style={styles.hubName} numberOfLines={1}>{market.name}</Text>
          <Text style={styles.hubMeta} numberOfLines={1}>{district}</Text>
        </View>

        <View style={styles.hubDivider} />

        <View style={styles.hubBottom}>
          <View style={styles.typeBadge}>
            <View style={styles.typeDot} />
            <Text style={styles.typeText}>{hubType(market)}</Text>
          </View>
          <View style={styles.dataBlock}>
            <Text style={styles.dataLabel}>{promo === 'OPEN' ? 'STATUS' : 'PEAK PROMO'}</Text>
            <Text style={styles.dataValue}>{promo}</Text>
          </View>
        </View>

        <View style={styles.ratingRow}>
          <Star color={colors.primaryMid} fill={colors.primaryMid} size={13} />
          <Text style={styles.ratingText}>
            {Number(market.rating || 4.6).toFixed(1)} rating · {market.totalSellers || 0} sellers
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 112 },
  stickyHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighest,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageTitle: { color: colors.ink, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.surfaceHigh, borderRadius: 4, padding: 2 },
  viewButton: { width: 38, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  viewButtonActive: { backgroundColor: colors.card },
  searchBox: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '500', paddingVertical: 0 },
  chips: { gap: 8, paddingVertical: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  chipText: { color: colors.body, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chipTextActive: { color: colors.primaryDark },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8 },
  metricText: { color: colors.body, fontSize: 15, fontWeight: '400' },
  metricValue: { color: colors.ink, fontWeight: '700' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryMid },
  liveText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  hubList: { paddingHorizontal: 16, gap: 8 },
  hubCard: {
    minHeight: 118,
    flexDirection: 'row',
    gap: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: 8,
    position: 'relative',
  },
  hubImage: { width: 90, height: 100, borderRadius: 4, backgroundColor: colors.surfaceHigh },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageInitial: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 22,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubBody: { flex: 1, justifyContent: 'space-between', paddingVertical: 4, paddingRight: 4 },
  hubName: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  hubMeta: { color: colors.body, fontSize: 14, lineHeight: 20, marginTop: 2 },
  hubDivider: { height: 1, backgroundColor: colors.surfaceHighest, marginTop: 8 },
  hubBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  typeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primaryMid },
  typeText: { color: colors.ink, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  dataBlock: { alignItems: 'flex-end' },
  dataLabel: { color: colors.body, fontSize: 10, fontWeight: '800' },
  dataValue: { color: colors.primaryMid, fontSize: 14, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ratingText: { color: colors.faint, fontSize: 11, fontWeight: '600' },
  mapCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
  },
  mapCanvas: { height: 190, backgroundColor: colors.surfaceHigh, position: 'relative' },
  mapPin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryMid,
    borderWidth: 3,
    borderColor: colors.card,
  },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  mapText: { color: colors.body, fontSize: 13, fontWeight: '700' },
});
