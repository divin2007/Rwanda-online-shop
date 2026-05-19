import React, { useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, MapPin, Search, SlidersHorizontal, Store, Tag } from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Market, Product, Promotion } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type MarketPayload = {
  market: Market | null;
  markets: Market[];
  products: Product[];
  categories: CatalogCategory[];
  promotions: Promotion[];
};

const promoProduct = (promo: Promotion): Product | undefined => {
  if (promo.product) return promo.product;
  return typeof promo.productId === 'object' ? promo.productId : undefined;
};

const loadMarket = async (marketId: string): Promise<MarketPayload> => {
  const categoriesPromise = api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false });

  if (marketId === 'all') {
    const [markets, products, categories, promotions] = await Promise.all([
      api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
      api.get<Product[]>('product', '/products?limit=90&isActive=true&sortBy=-totalOrders', { auth: false }),
      categoriesPromise,
      api.get<Promotion[]>('product', '/promotions/active', { auth: false }).catch(() => []),
    ]);
    return {
      market: null,
      markets: asArray(markets),
      products: asArray(products),
      categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
      promotions: asArray(promotions),
    };
  }

  const market = await api.get<Market>('market', `/markets/${marketId}`, { auth: false })
    .catch(() => api.get<Market>('market', `/markets/slug/${marketId}`, { auth: false }));
  const [products, categories, promotions] = await Promise.all([
    api.get<Product[]>('product', `/products?marketId=${encodeURIComponent(market._id)}&isActive=true&limit=90&sortBy=-totalOrders`, { auth: false }),
    categoriesPromise,
    api.get<Promotion[]>('product', `/promotions/active?marketId=${encodeURIComponent(market._id)}`, { auth: false }).catch(() => []),
  ]);
  return {
    market,
    markets: [],
    products: asArray(products),
    categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
    promotions: asArray(promotions),
  };
};

export default function MarketScreen() {
  const router = useRouter();
  const { marketId } = useLocalSearchParams<{ marketId: string }>();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [marketDistrict, setMarketDistrict] = useState<string | null>(null);
  const { data, loading, refreshing, error, refresh } = useRemote(() => loadMarket(String(marketId || 'all')), [marketId]);

  const products = data?.products || [];
  const markets = data?.markets || [];
  const categories = data?.categories || [];
  const promotions = data?.promotions || [];
  const promoIds = new Set(promotions.map(promoProduct).filter(Boolean).map(product => product!._id));

  const districts = useMemo(() => Array.from(new Set(markets.map(market => market.location?.district).filter(Boolean))) as string[], [markets]);
  const filteredMarkets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return markets.filter(market => {
      const text = [market.name, market.code, market.type, market.location?.district, market.location?.address].filter(Boolean).join(' ').toLowerCase();
      return (!needle || text.includes(needle)) && (!marketDistrict || market.location?.district === marketDistrict);
    });
  }, [marketDistrict, markets, search]);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter(product => {
      const text = [product.name, product.description, product.categoryLabel, product.category].filter(Boolean).join(' ').toLowerCase();
      return (!needle || text.includes(needle))
        && (!categoryId || product.categoryId === categoryId || product.productType === categoryId)
        && (!onlyDeals || promoIds.has(product._id) || Boolean(product.promotion));
    });
  }, [categoryId, onlyDeals, products, promoIds, search]);

  const promotedProducts = promotions.map(promoProduct).filter(Boolean).filter(product => {
    if (!data?.market) return true;
    const productMarket = typeof product!.marketId === 'object' ? product!.marketId?._id : product!.marketId;
    return !productMarket || productMarket === data.market._id;
  }) as Product[];

  if (loading && !data) return <LoadingBlock label="Loading market and product filters..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!data) return <EmptyBlock title="Market unavailable" />;

  if (!data.market) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
        contentContainerStyle={styles.listContent}
      >
        <View style={styles.listHero}>
          <Text style={styles.title}>All live markets</Text>
          <Text style={styles.subtitle}>Search every RMF market by name, district, code, or address.</Text>
        </View>
        <View style={styles.filterPanel}>
          <View style={styles.searchBar}>
            <Search color={colors.orange} size={17} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search markets" placeholderTextColor={colors.faint} style={styles.searchInput} />
            <SlidersHorizontal color={colors.orangeDark} size={17} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip label="All districts" active={!marketDistrict} onPress={() => setMarketDistrict(null)} />
            {districts.map(district => <FilterChip key={district} label={district} active={marketDistrict === district} onPress={() => setMarketDistrict(current => current === district ? null : district)} />)}
          </ScrollView>
        </View>
        <View style={styles.marketList}>
          {filteredMarkets.length ? filteredMarkets.map(market => (
            <MarketCard key={market._id} market={market} onPress={() => router.push(`/market/${market._id}`)} />
          )) : <EmptyBlock title="No markets match" body="Try another search or district." />}
        </View>
      </ScrollView>
    );
  }

  const market = data.market;
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        {market.imageUrl ? <Image source={{ uri: market.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
        <View style={styles.heroOverlay} />
        <View style={styles.heroBody}>
          <Text style={styles.marketType}>{market.type || market.code || 'Market'}</Text>
          <Text style={styles.heroTitle}>{market.name}</Text>
          <View style={styles.heroMeta}>
            <MapPin color={colors.orange} size={15} />
            <Text style={styles.heroMetaText}>{market.location?.address || market.location?.district || 'Location managed by RMF'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Store color={colors.orange} size={18} />
          <Text style={styles.infoValue}>{market.totalSellers || 0}</Text>
          <Text style={styles.infoLabel}>Sellers</Text>
        </View>
        <View style={styles.infoCard}>
          <Clock color={colors.orange} size={18} />
          <Text style={styles.infoValue}>{market.operatingHours?.open || '--'} - {market.operatingHours?.close || '--'}</Text>
          <Text style={styles.infoLabel}>Hours</Text>
        </View>
      </View>

      {promotedProducts.length ? (
        <Section title="Promotions in this market" meta={`${promotedProducts.length} deals`}>
          <FlatList
            horizontal
            data={promotions.filter(promo => promoProduct(promo))}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
            renderItem={({ item }) => {
              const product = promoProduct(item);
              if (!product) return null;
              return (
                <TouchableOpacity style={styles.promoCard} onPress={() => router.push(`/product/${product._id}`)} activeOpacity={0.88}>
                  <View style={styles.promoTop}><Tag color={colors.orangeDark} size={14} /><Text style={styles.promoText}>{item.discount || 0}% off</Text></View>
                  <Text style={styles.promoTitle} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.promoPrice}>{money(item.promotedPrice || product.price)}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </Section>
      ) : null}

      {market.description ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>About this market</Text>
          <Text style={styles.description}>{market.description}</Text>
        </View>
      ) : null}

      <View style={styles.filterPanel}>
        <View style={styles.searchBar}>
          <Search color={colors.orange} size={17} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search products in this market" placeholderTextColor={colors.faint} style={styles.searchInput} />
          <SlidersHorizontal color={colors.orangeDark} size={17} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All products" active={!categoryId && !onlyDeals} onPress={() => { setCategoryId(null); setOnlyDeals(false); }} />
          <FilterChip label="Deals" active={onlyDeals} onPress={() => setOnlyDeals(current => !current)} />
          {categories.map(category => (
            <FilterChip key={category.id} label={category.label} active={categoryId === category.id} onPress={() => setCategoryId(current => current === category.id ? null : category.id)} />
          ))}
        </ScrollView>
      </View>

      <Section title="Market shelf" meta={`${filteredProducts.length} live`}>
        {filteredProducts.length ? (
          <View style={styles.grid}>
            {filteredProducts.map(product => (
              <ProductCard key={product._id} product={product} compact onPress={() => router.push(`/product/${product._id}`)} />
            ))}
          </View>
        ) : (
          <EmptyBlock title="No products match" body="Try a different search or filter." />
        )}
      </Section>

      <Section title="Seller videos" meta="Shop adverts and demos">
        <SellerVideoFeed marketId={market._id} compact />
      </Section>
    </ScrollView>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.count}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 36 },
  listContent: { padding: 16, gap: 16, paddingBottom: 36 },
  listHero: { borderRadius: 16, backgroundColor: colors.orangeDark, padding: 18, gap: 7 },
  title: { color: colors.card, fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  marketList: { gap: 14 },
  hero: { height: 260, backgroundColor: colors.orangeDark },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(124,45,18,0.52)' },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 22, gap: 8 },
  marketType: { alignSelf: 'flex-start', backgroundColor: colors.orange, color: colors.card, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  heroTitle: { color: colors.card, fontSize: 31, fontWeight: '900', lineHeight: 36 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroMetaText: { color: '#fff7ed', fontSize: 13, fontWeight: '700', flex: 1 },
  infoGrid: { flexDirection: 'row', gap: 12, padding: 16 },
  infoCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 6 },
  infoValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  panel: { marginHorizontal: 16, marginTop: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 8 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  filterPanel: { marginHorizontal: 16, gap: 10 },
  searchBar: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: { height: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  chipTextActive: { color: colors.orangeDark },
  section: { marginTop: 20 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  count: { color: colors.faint, fontSize: 11, fontWeight: '900' },
  horizontal: { paddingHorizontal: 16, gap: 12 },
  promoCard: { width: 170, borderRadius: 12, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: colors.orangeSoft, padding: 12, gap: 8 },
  promoTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  promoTitle: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  promoPrice: { color: colors.orangeDark, fontSize: 16, fontWeight: '900' },
  grid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});
