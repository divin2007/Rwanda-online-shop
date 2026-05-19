import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ShieldCheck, SlidersHorizontal, Video } from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { compactNumber } from '../../src/lib/format';
import { colors } from '../../src/theme';
import { CatalogCategory, Market, Product } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type ShopPayload = {
  products: Product[];
  markets: Market[];
  categories: CatalogCategory[];
  publicStats: Record<string, any> | null;
};

const loadShop = async (search: string): Promise<ShopPayload> => {
  const params = new URLSearchParams({ limit: '40', isActive: 'true', sortBy: '-totalOrders' });
  if (search.trim()) params.set('search', search.trim());

  const [products, markets, categories, publicStats] = await Promise.all([
    api.get<Product[]>('product', `/products/recommendations/for-me?${params.toString()}`)
      .catch(() => api.get<Product[]>('product', `/products?${params.toString()}`, { auth: false })),
    api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Record<string, any>>('order', '/orders/public/stats', { auth: false }).catch(() => null),
  ]);

  return {
    products: asArray<Product>(products),
    markets: asArray<Market>(markets),
    categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
    publicStats,
  };
};

export default function ShopScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { data, loading, refreshing, error, refresh } = useRemote(() => loadShop(search), [search]);

  const products = useMemo(() => {
    const allProducts = data?.products || [];
    if (!categoryId) return allProducts;
    return allProducts.filter(product => product.categoryId === categoryId || product.productType === categoryId);
  }, [categoryId, data?.products]);

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const markets = data?.markets || [];
  const categories = data?.categories || [];
  const stats = data?.publicStats || {};

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.trustPill}>
          <ShieldCheck color={colors.greenDark} size={14} />
          <Text style={styles.trustText}>Live verified RMF marketplace</Text>
        </View>
        <Text style={styles.heroTitle}>Shop local markets with escrow-backed delivery.</Text>
        <View style={styles.searchBar}>
          <Search color={colors.muted} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search markets, products, sellers..."
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <SlidersHorizontal color={colors.orange} size={18} />
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{compactNumber(markets.length)}</Text>
            <Text style={styles.statLabel}>Markets</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{compactNumber(products.length)}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{compactNumber(Number(stats.ordersToday || stats.totalOrders || 0))}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.videoCta} onPress={() => router.push('/videos')} activeOpacity={0.88}>
        <View style={styles.videoIcon}>
          <Video color={colors.card} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.videoTitle}>Seller video market</Text>
          <Text style={styles.videoBody}>Watch shop adverts and product demos before ordering.</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Markets near RMF buyers</Text>
          <TouchableOpacity onPress={() => router.push('/markets')}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>
        {markets.length ? (
          <FlatList
            horizontal
            data={markets}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <View style={styles.marketCardWrap}>
                <MarketCard market={item} onPress={() => router.push(`/market/${item._id}`)} />
              </View>
            )}
          />
        ) : (
          <EmptyBlock title="No live markets returned" body="The market service did not return active markets." />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse categories</Text>
          {categoryId ? (
            <TouchableOpacity onPress={() => setCategoryId(null)}>
              <Text style={styles.sectionLink}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryPill, categoryId === category.id && styles.categoryPillActive]}
              onPress={() => setCategoryId(current => current === category.id ? null : category.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.categoryText, categoryId === category.id && styles.categoryTextActive]}>{category.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending products</Text>
          <Text style={styles.countText}>{products.length} live</Text>
        </View>
        {products.length ? (
          <View style={styles.grid}>
            {products.map(product => (
              <ProductCard
                key={product._id}
                product={product}
                compact
                onPress={() => router.push(`/product/${product._id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyBlock title="No products match this view" body="Try another search or category." />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  hero: {
    margin: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.greenDark,
    gap: 16,
  },
  trustPill: {
    alignSelf: 'flex-start',
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.orange,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.card,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  searchBar: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
  },
  statValue: {
    color: colors.orange,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#ffedd5',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  section: {
    marginTop: 10,
  },
  videoCta: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: colors.orangeSoft,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  videoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  videoBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  lastSection: {
    paddingBottom: 36,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionLink: {
    color: colors.orangeDark,
    fontSize: 12,
    fontWeight: '900',
  },
  countText: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: '900',
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 14,
  },
  marketCardWrap: {
    width: 280,
  },
  categoryRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  categoryPillActive: {
    borderColor: colors.orange,
    backgroundColor: colors.orangeSoft,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  categoryTextActive: {
    color: colors.orangeDark,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
});
