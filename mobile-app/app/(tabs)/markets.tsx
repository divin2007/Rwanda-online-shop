import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, ChevronRight, MapPinned, Search, SlidersHorizontal, Tag, Video, Clock } from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { MapPreview, MapPoint } from '../../src/components/MapPreview';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { api } from '../../src/lib/api';
import { asArray, coordinatesOfMarket, idOf } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Market, Product, Promotion } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type MarketsPayload = {
  categories: CatalogCategory[];
  markets: Market[];
  products: Product[];
  promotions: Promotion[];
};

const productFromPromotion = (promotion: Promotion): Product | undefined => {
  if (promotion.product) return promotion.product;
  return typeof promotion.productId === 'object' ? promotion.productId : undefined;
};

const loadMarkets = async (): Promise<MarketsPayload> => {
  const [markets, categories, products, promotions] = await Promise.all([
    api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Product[]>('product', '/products?limit=36&isActive=true&sortBy=-totalOrders', { auth: false }),
    api.get<Promotion[]>('product', '/promotions/active', { auth: false }).catch(() => []),
  ]);
  return {
    markets: asArray<Market>(markets),
    categories: asArray<CatalogCategory>(categories).filter(c => c.isActive !== false),
    products: asArray<Product>(products),
    promotions: asArray<Promotion>(promotions),
  };
};

export default function MarketsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; categoryId?: string }>();
  const [query, setQuery] = useState(String(params.search || ''));
  const [marketType, setMarketType] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(params.categoryId ? String(params.categoryId) : null);

  // Sync state with route parameters
  useEffect(() => {
    setQuery(String(params.search || ''));
  }, [params.search]);

  useEffect(() => {
    setActiveCategory(params.categoryId ? String(params.categoryId) : null);
  }, [params.categoryId]);

  const { data, loading, refreshing, error, refresh } = useRemote(loadMarkets, []);

  const markets = data?.markets || [];
  const categories = data?.categories || [];
  const products = data?.products || [];
  const promotedProducts = useMemo(
    () => (data?.promotions || []).map(productFromPromotion).filter(Boolean) as Product[],
    [data?.promotions],
  );
  const marketTypes = useMemo(
    () => Array.from(new Set(markets.map(m => m.type).filter(Boolean))) as string[],
    [markets],
  );
  const filteredMarkets = useMemo(() => {
    const norm = query.trim().toLowerCase();
    return markets
      .filter(m => !marketType || m.type === marketType)
      .filter(m => {
        if (!norm) return true;
        return [m.name, m.code, m.type, m.description, m.location?.district, m.location?.sector]
          .filter(Boolean).join(' ').toLowerCase().includes(norm);
      })
      .sort((a, b) => ((b.rating || 0) * 10 + (b.totalSellers || 0)) - ((a.rating || 0) * 10 + (a.totalSellers || 0)));
  }, [markets, marketType, query]);

  const categoryProducts = useMemo(() => {
    if (!activeCategory) return products.slice(0, 10);
    return products.filter(p => p.categoryId === activeCategory || p.category === activeCategory).slice(0, 10);
  }, [activeCategory, products]);

  const mapPoints: MapPoint[] = useMemo(
    () => filteredMarkets.slice(0, 12).map(m => ({
      label: m.name,
      tone: 'pickup',
      coordinates: coordinatesOfMarket(m),
    })),
    [filteredMarkets],
  );

  if (loading && !data) return <LoadingBlock label="Loading markets..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {/* ── Page title bar ───────────────────────────────────────────────── */}
      <View style={styles.titleBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Markets</Text>
          <Text style={styles.pageSubtitle}>{filteredMarkets.length} verified Rwandan markets</Text>
        </View>
        <View style={styles.countPill}>
          <MapPinned color={colors.primary} size={14} />
          <Text style={styles.countPillText}>{filteredMarkets.length}</Text>
        </View>
      </View>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <View style={styles.searchCard}>
        <View style={styles.searchBox}>
          <Search color={colors.muted} size={16} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setQuery(query.trim())}
            placeholder="Search market, district, product..."
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* ── Market type filter tabs ───────────────────────────────────────── */}
      {marketTypes.length > 0 && (
        <View style={styles.tabRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            <TypeTab label="All" active={!marketType} onPress={() => setMarketType(null)} />
            {marketTypes.map(t => (
              <TypeTab key={t} label={t} active={marketType === t} onPress={() => setMarketType(t)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Deal products from promotions ─────────────────────────────────── */}
      {promotedProducts.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            icon={<Tag color={colors.primary} size={16} strokeWidth={2} />}
            title="Market Deals"
            onAction={() => router.push('/products' as any)}
          />
          <FlatList
            horizontal
            data={promotedProducts.slice(0, 10)}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRail}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                style={{ width: 130 }}
                onPress={() => router.push(`/product/${item._id}` as any)}
              />
            )}
          />
        </View>
      )}

      {/* ── Map preview ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon={<MapPinned color={colors.primary} size={16} strokeWidth={2} />}
          title="Market Map"
        />
        <MapPreview title="RMF Market Locations" points={mapPoints} />
      </View>

      {/* ── All markets 3-column grid ─────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon={<MapPinned color={colors.primary} size={16} strokeWidth={2} />}
          title="All Markets"
        />
        {filteredMarkets.length ? (
          <View style={styles.marketGrid}>
            {filteredMarkets.map((market, index) => (
              <MarketCard
                key={idOf(market) || market.name}
                market={market}
                compact
                rank={index < 5 ? index + 1 : undefined}
                onPress={() => {
                  const id = idOf(market);
                  if (id) router.push(`/market/${id}` as any);
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyBlock
            title="No markets found"
            body="Change your search or filter."
            actionLabel="Clear"
            onAction={() => { setQuery(''); setMarketType(null); setActiveCategory(null); }}
          />
        )}
      </View>

      {/* ── Category product filter ───────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon={<Clock color={colors.primary} size={16} strokeWidth={2} />}
          title="Popular Products"
          onAction={() => router.push('/products' as any)}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips}>
          <CategoryChip label="All" active={!activeCategory} onPress={() => setActiveCategory(null)} />
          {categories.slice(0, 12).map(cat => (
            <CategoryChip key={cat.id} label={cat.label} active={activeCategory === cat.id} onPress={() => setActiveCategory(cat.id)} />
          ))}
        </ScrollView>

        {categoryProducts.length ? (
          <FlatList
            horizontal
            data={categoryProducts}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRail}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                style={{ width: 130 }}
                onPress={() => router.push(`/product/${item._id}` as any)}
              />
            )}
          />
        ) : null}
      </View>

      {/* ── Video feed ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon={<Video color={colors.primary} size={16} strokeWidth={2} />}
          title="Market Videos"
          onAction={() => router.push('/videos' as any)}
        />
        <SellerVideoFeed compact marketId={filteredMarkets[0]?._id} />
      </View>
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title, onAction }: { icon: React.ReactNode; title: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onAction && (
        <TouchableOpacity style={styles.seeAll} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.seeAllText}>See all</Text>
          <ChevronRight color={colors.primary} size={13} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function TypeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 100 },

  // Title bar
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  pageTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '500', marginTop: 2 },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countPillText: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  // Search
  searchCard: {
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  searchBox: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '500', paddingVertical: 0 },

  // Type tabs
  tabRow: { backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  // Sections
  section: {
    marginTop: 10,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: colors.divider,
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  // Market grid
  marketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    rowGap: 8,
  },

  // Horizontal rails
  hRail: { paddingHorizontal: 12, gap: 8 },
  hChips: { paddingHorizontal: 12, gap: 7, marginBottom: 4 },

  // Category chips
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
});
