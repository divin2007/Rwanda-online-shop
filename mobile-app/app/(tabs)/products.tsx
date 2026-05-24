import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, Search, SlidersHorizontal, X, Star, Flame, ArrowDownNarrowWide, ArrowUpNarrowWide, Tag } from 'lucide-react-native';
import { ProductCard } from '../../src/components/Cards';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Product, Promotion } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type SortMode = 'recommended' | 'popular' | 'price_low' | 'price_high' | 'deals';

type ProductsPayload = {
  categories: CatalogCategory[];
  products: Product[];
  promotions: Promotion[];
};

const productFromPromotion = (p: Promotion): Product | undefined => {
  if (p.product) return p.product;
  return typeof p.productId === 'object' ? p.productId : undefined;
};

const loadProducts = async (search: string, categoryId: string | null, sort: SortMode): Promise<ProductsPayload> => {
  const params = new URLSearchParams({ limit: '80', isActive: 'true' });
  if (search.trim()) params.set('search', search.trim());
  if (categoryId) params.set('categoryId', categoryId);
  if (sort === 'popular') params.set('sortBy', '-totalOrders');
  if (sort === 'price_low') params.set('sortBy', 'price');
  if (sort === 'price_high') params.set('sortBy', '-price');

  const productPath = sort === 'recommended'
    ? `/products/recommendations/for-me?${params}`
    : `/products?${params}`;

  const [products, categories, promotions] = await Promise.all([
    api.get<Product[]>('product', productPath)
      .catch(() => api.get<Product[]>('product', `/products?${params}`, { auth: false })),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Promotion[]>('product', '/promotions/active', { auth: false }).catch(() => []),
  ]);

  return {
    products: asArray<Product>(products),
    categories: asArray<CatalogCategory>(categories).filter(c => c.isActive !== false),
    promotions: asArray<Promotion>(promotions),
  };
};

const SORT_OPTIONS: { label: string; value: SortMode; icon: any }[] = [
  { label: 'For You', value: 'recommended', icon: Star },
  { label: 'Best Sellers', value: 'popular', icon: Flame },
  { label: 'Low to High', value: 'price_low', icon: ArrowDownNarrowWide },
  { label: 'High to Low', value: 'price_high', icon: ArrowUpNarrowWide },
  { label: 'Deals Only', value: 'deals', icon: Tag },
];

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; categoryId?: string; sort?: string }>();

  const [draftSearch, setDraftSearch] = useState(String(params.search || ''));
  const [search, setSearch] = useState(String(params.search || ''));
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ? String(params.categoryId) : null);
  const [sort, setSort] = useState<SortMode>((params.sort as SortMode) || 'recommended');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Keep state in sync with route parameter changes (e.g. searching from header)
  useEffect(() => {
    const nextSearch = String(params.search || '');
    setDraftSearch(nextSearch);
    setSearch(nextSearch);
  }, [params.search]);

  useEffect(() => {
    setCategoryId(params.categoryId ? String(params.categoryId) : null);
  }, [params.categoryId]);

  useEffect(() => {
    setSort((params.sort as SortMode) || 'recommended');
  }, [params.sort]);

  const { data, loading, refreshing, error, refresh } = useRemote(
    () => loadProducts(search, categoryId, sort),
    [search, categoryId, sort],
  );

  const categories = data?.categories || [];
  const promotedIds = useMemo(
    () => new Set((data?.promotions || []).map(p => productFromPromotion(p)?._id).filter(Boolean) as string[]),
    [data?.promotions],
  );

  const visibleProducts = useMemo(() => {
    let src = data?.products || [];
    if (sort === 'deals') {
      src = src.filter(p => promotedIds.has(p._id) || Boolean(p.promotion));
    }
    return src;
  }, [data?.products, sort, promotedIds]);

  const activeSortOpt = SORT_OPTIONS.find(o => o.value === sort);
  const SortIcon = activeSortOpt?.icon || Star;
  const hasFilters = !!search || !!categoryId || sort !== 'recommended';

  if (loading && !data) return <LoadingBlock label="Searching products..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <View style={styles.screen}>
      {/* ── Sticky header block ────────────────────────────────────────── */}
      <View style={styles.headerBlock}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search color={colors.muted} size={15} strokeWidth={2} />
            <TextInput
              value={draftSearch}
              onChangeText={setDraftSearch}
              onSubmitEditing={() => setSearch(draftSearch.trim())}
              placeholder="Search products..."
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {draftSearch.length > 0 && (
              <TouchableOpacity onPress={() => { setDraftSearch(''); setSearch(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={colors.faint} size={14} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sort + Filter row */}
        <View style={styles.controlRow}>
          {/* Sort picker */}
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setShowSortMenu(v => !v)}
            activeOpacity={0.8}
          >
            <SortIcon color={colors.primary} size={12} strokeWidth={2.5} style={{ marginRight: 2 }} />
            <Text style={styles.sortBtnText}>{activeSortOpt?.label || 'Sort'}</Text>
            <ChevronDown color={colors.primary} size={13} />
          </TouchableOpacity>

          {/* Clear filters */}
          {hasFilters && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setDraftSearch(''); setSearch(''); setCategoryId(null); setSort('recommended'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
              <X color={colors.primary} size={11} />
            </TouchableOpacity>
          )}

          {/* Result count */}
          <Text style={styles.resultCount}>{visibleProducts.length} items</Text>
        </View>

        {/* Sort dropdown */}
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              const isActive = sort === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortOption, isActive && styles.sortOptionActive]}
                  onPress={() => { setSort(opt.value); setShowSortMenu(false); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <OptIcon color={isActive ? colors.primary : colors.muted} size={14} strokeWidth={isActive ? 2.5 : 2} />
                    <Text style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <CategoryChip label="All" active={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map(cat => (
            <CategoryChip
              key={cat.id}
              label={cat.label}
              active={categoryId === cat.id}
              onPress={() => setCategoryId(v => v === cat.id ? null : cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Product grid ──────────────────────────────────────────────── */}
      <FlatList
        data={visibleProducts}
        keyExtractor={item => item._id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            compact
            style={{ flex: 1, maxWidth: '48.5%' }}
            onPress={() => router.push(`/product/${item._id}` as any)}
          />
        )}
        ListEmptyComponent={(
          <EmptyBlock
            title="No products found"
            body="Try a different search or category."
            actionLabel="Clear filters"
            onAction={() => { setDraftSearch(''); setSearch(''); setCategoryId(null); setSort('recommended'); }}
          />
        )}
      />
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Header block
  headerBlock: {
    backgroundColor: colors.card,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
    paddingBottom: 8,
  },

  // Search
  searchRow: { padding: 10 },
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

  // Controls
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  sortBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
  },
  clearBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  resultCount: { color: colors.faint, fontSize: 12, fontWeight: '600', marginLeft: 'auto' as any },

  // Sort dropdown
  sortMenu: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  sortOptionActive: { backgroundColor: colors.primarySoft },
  sortOptionText: { color: colors.body, fontSize: 13, fontWeight: '600' },
  sortOptionTextActive: { color: colors.primary, fontWeight: '700' },

  // Category chips
  chips: { paddingHorizontal: 10, gap: 7 },
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
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  // Grid
  gridContent: { padding: 10, paddingBottom: 100 },
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
});
