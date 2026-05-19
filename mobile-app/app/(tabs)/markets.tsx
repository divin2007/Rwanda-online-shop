import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, SlidersHorizontal, Sparkles, Tag } from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { compactNumber, money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Market, Product, Promotion } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type MarketsPayload = {
  markets: Market[];
  products: Product[];
  promotions: Promotion[];
  categories: CatalogCategory[];
  stats: Record<string, any> | null;
};

const promoProduct = (promo: Promotion): Product | undefined => {
  if (promo.product) return promo.product;
  return typeof promo.productId === 'object' ? promo.productId : undefined;
};

const loadMarkets = async (): Promise<MarketsPayload> => {
  const [markets, products, promotions, categories, stats] = await Promise.all([
    api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    api.get<Product[]>('product', '/products/recommendations/for-me?limit=80&isActive=true')
      .catch(() => api.get<Product[]>('product', '/products?limit=80&isActive=true&sortBy=-totalOrders', { auth: false })),
    api.get<Promotion[]>('product', '/promotions/active', { auth: false }).catch(() => []),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Record<string, any>>('order', '/orders/public/stats', { auth: false }).catch(() => null),
  ]);

  return {
    markets: asArray(markets),
    products: asArray(products),
    promotions: asArray(promotions),
    categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
    stats,
  };
};

export default function MarketsTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const [search, setSearch] = useState(params.search || '');
  const [district, setDistrict] = useState<string | null>(null);
  const [marketType, setMarketType] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { data, loading, refreshing, error, refresh } = useRemote(loadMarkets, []);

  const markets = data?.markets || [];
  const products = data?.products || [];
  const categories = data?.categories || [];
  const promotions = data?.promotions || [];
  const stats = data?.stats || {};

  const districts = useMemo(() => Array.from(new Set(markets.map(market => market.location?.district).filter(Boolean))) as string[], [markets]);
  const marketTypes = useMemo(() => Array.from(new Set(markets.map(market => market.type).filter(Boolean))) as string[], [markets]);

  const filteredMarkets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return markets.filter(market => {
      const text = [market.name, market.code, market.type, market.location?.district, market.location?.address].filter(Boolean).join(' ').toLowerCase();
      return (!needle || text.includes(needle))
        && (!district || market.location?.district === district)
        && (!marketType || market.type === marketType);
    });
  }, [district, marketType, markets, search]);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter(product => {
      const text = [product.name, product.description, product.categoryLabel, product.category].filter(Boolean).join(' ').toLowerCase();
      return (!needle || text.includes(needle))
        && (!categoryId || product.categoryId === categoryId || product.productType === categoryId);
    });
  }, [categoryId, products, search]);

  const madeInRwanda = filteredProducts.filter(product => product.isMadeInRwanda).slice(0, 8);
  const promotedProducts = promotions.map(promoProduct).filter(Boolean) as Product[];

  if (loading && !data) return <LoadingBlock label="Loading markets, promotions, and live catalog..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroPill}>
          <Sparkles color={colors.orangeDark} size={14} />
          <Text style={styles.heroPillText}>Market discovery</Text>
        </View>
        <Text style={styles.title}>Find the right market, seller, and product faster.</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{compactNumber(markets.length)}</Text><Text style={styles.statLabel}>Markets</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{compactNumber(products.length)}</Text><Text style={styles.statLabel}>Products</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{compactNumber(Number(stats.ordersToday || stats.totalOrders || 0))}</Text><Text style={styles.statLabel}>Orders</Text></View>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.search}>
          <Search color={colors.orange} size={17} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search markets or products" placeholderTextColor={colors.faint} style={styles.searchInput} />
          <SlidersHorizontal color={colors.orangeDark} size={17} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="All markets" active={!district && !marketType} onPress={() => { setDistrict(null); setMarketType(null); }} />
          {districts.map(item => <FilterChip key={item} label={item} active={district === item} onPress={() => setDistrict(current => current === item ? null : item)} />)}
          {marketTypes.map(item => <FilterChip key={item} label={item} active={marketType === item} onPress={() => setMarketType(current => current === item ? null : item)} />)}
        </ScrollView>
      </View>

      {promotedProducts.length ? (
        <Section title="Live promotions" meta={`${promotedProducts.length} deals`}>
          <FlatList
            horizontal
            data={promotions}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
            renderItem={({ item }) => {
              const product = promoProduct(item);
              if (!product) return null;
              return (
                <TouchableOpacity style={styles.promoCard} onPress={() => router.push(`/product/${product._id}`)} activeOpacity={0.88}>
                  <View style={styles.promoTop}>
                    <Tag color={colors.orangeDark} size={15} />
                    <Text style={styles.promoText}>{item.discount || 0}% off</Text>
                  </View>
                  <Text style={styles.promoTitle} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.promoPrice}>{money(item.promotedPrice || product.price)}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </Section>
      ) : null}

      <Section title="Product navigation" meta={categoryId ? 'Filtered' : 'Live taxonomy'}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="All products" active={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map(category => (
            <FilterChip key={category.id} label={category.label} active={categoryId === category.id} onPress={() => setCategoryId(current => current === category.id ? null : category.id)} />
          ))}
        </ScrollView>
      </Section>

      {madeInRwanda.length ? (
        <Section title="Made in Rwanda" meta={`${madeInRwanda.length} local`}>
          <FlatList
            horizontal
            data={madeInRwanda}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
            renderItem={({ item }) => <ProductCard product={item} onPress={() => router.push(`/product/${item._id}`)} />}
          />
        </Section>
      ) : null}

      <Section title="Most bought products" meta={`${filteredProducts.length} live`}>
        {filteredProducts.length ? (
          <FlatList
            horizontal
            data={filteredProducts.slice(0, 16)}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
            renderItem={({ item }) => <ProductCard product={item} onPress={() => router.push(`/product/${item._id}`)} />}
          />
        ) : (
          <EmptyBlock title="No products match" body="Try a different category or search." />
        )}
      </Section>

      <Section title="All markets" meta={`${filteredMarkets.length} visible`}>
        <View style={styles.marketList}>
          {filteredMarkets.length ? filteredMarkets.map(market => (
            <MarketCard key={market._id} market={market} onPress={() => router.push(`/market/${market._id}`)} />
          )) : (
            <EmptyBlock title="No markets match" body="Clear a filter or search for another district." />
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
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
  content: { paddingBottom: 34 },
  hero: { margin: 16, borderRadius: 16, backgroundColor: colors.orangeDark, padding: 18, gap: 14 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.orangeSoft },
  heroPillText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.card, fontSize: 26, fontWeight: '900', lineHeight: 31 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 11 },
  statValue: { color: colors.card, fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#ffedd5', fontSize: 10, fontWeight: '900', marginTop: 2, textTransform: 'uppercase' },
  filters: { marginHorizontal: 16, marginBottom: 12, gap: 10 },
  search: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  chips: { gap: 8, paddingRight: 16 },
  chip: { height: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  chipTextActive: { color: colors.orangeDark },
  section: { marginTop: 18 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: colors.faint, fontSize: 11, fontWeight: '900' },
  horizontal: { paddingHorizontal: 16, gap: 12 },
  promoCard: { width: 170, borderRadius: 12, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: colors.orangeSoft, padding: 12, gap: 8 },
  promoTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  promoTitle: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  promoPrice: { color: colors.orangeDark, fontSize: 16, fontWeight: '900' },
  marketList: { paddingHorizontal: 16, gap: 12 },
});
