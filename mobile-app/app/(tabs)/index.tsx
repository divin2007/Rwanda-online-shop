import React, { useMemo, useState, useEffect } from 'react';
import {
  FlatList, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight, ChevronRight, Flame, MapPinned,
  ShoppingBag, Sparkles, Video, Zap, Star,
  Package, Truck, Shield, Gift,
} from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { api } from '../../src/lib/api';
import { asArray, idOf } from '../../src/lib/normalize';
import { colors, shadowMd } from '../../src/theme';
import { CatalogCategory, Market, Product, Promotion } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type HomePayload = {
  categories: CatalogCategory[];
  markets: Market[];
  recommended: Product[];
  trending: Product[];
  promotions: Promotion[];
  stats: Record<string, any> | null;
};

const productFromPromotion = (p: Promotion): Product | undefined => {
  if (p.product) return p.product;
  return typeof p.productId === 'object' ? p.productId : undefined;
};

const loadHome = async (search: string): Promise<HomePayload> => {
  const base = new URLSearchParams({ limit: '24', isActive: 'true' });
  if (search.trim()) base.set('search', search.trim());

  const [recommended, trending, markets, categories, promotions, stats] = await Promise.all([
    api.get<Product[]>('product', `/products/recommendations/for-me?${base}`)
      .catch(() => api.get<Product[]>('product', `/products?${base}&sortBy=-totalOrders`, { auth: false })),
    api.get<Product[]>('product', `/products?${base}&sortBy=-totalOrders`, { auth: false }),
    api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Promotion[]>('product', '/promotions/active', { auth: false }).catch(() => []),
    api.get<Record<string, any>>('order', '/orders/public/stats', { auth: false }).catch(() => null),
  ]);

  return {
    recommended: asArray<Product>(recommended),
    trending: asArray<Product>(trending),
    markets: asArray<Market>(markets),
    categories: asArray<CatalogCategory>(categories).filter(c => c.isActive !== false),
    promotions: asArray<Promotion>(promotions),
    stats,
  };
};

const BANNERS = [
  { id: '1', tag: 'HARVEST SEASON', title: 'Farm-Fresh Deals', sub: 'Up to 45% OFF direct from verified Rwandan farms', color: '#ff6b00', color2: '#e05300' },
  { id: '2', tag: 'SECURE ESCROW', title: 'Buy with Confidence', sub: 'Every order is escrow-protected until delivery confirmed', color: '#0066CC', color2: '#004EA6' },
  { id: '3', tag: 'BEST SELLERS', title: 'Kimironko Premium', sub: 'Top-rated spices, textiles & handcrafts. Same-day delivery', color: '#00A650', color2: '#007A3D' },
];

const QUICK_ACTIONS = [
  { id: 'deals', label: 'Flash\nDeals', icon: Zap, color: '#ff6b00', bg: '#ffedd5', badge: 'HOT' },
  { id: 'markets', label: 'Markets', icon: MapPinned, color: '#0066CC', bg: '#E8F0FC', badge: null },
  { id: 'new', label: 'New\nArrivals', icon: Package, color: '#00A650', bg: '#E8F8EF', badge: 'NEW' },
  { id: 'videos', label: 'Seller\nVideos', icon: Video, color: '#9B59B6', bg: '#F3E8FF', badge: 'LIVE' },
  { id: 'local', label: 'Made in\nRwanda', icon: Star, color: '#FFB800', bg: '#FFF8E1', badge: null },
  { id: 'deliver', label: 'Fast\nDeliver', icon: Truck, color: '#E67E22', bg: '#FEF3E2', badge: null },
  { id: 'promo', label: 'Vouchers', icon: Gift, color: '#E91E8C', bg: '#FCE4F3', badge: null },
  { id: 'secure', label: 'Secure\nBuy', icon: Shield, color: '#27AE60', bg: '#E8F8EF', badge: null },
];

export default function HomeScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [countdown, setCountdown] = useState({ h: 2, m: 34, s: 17 });

  const { data, loading, refreshing, error, refresh } = useRemote(
    () => loadHome(''),
    [],
  );

  const dynamicBanners = useMemo(() => {
    const list: Array<{ id: string; tag: string; title: string; sub: string; color: string; color2: string; productId?: string }> = [];
    
    // 1. Populate from active promotions
    if (data?.promotions && data.promotions.length > 0) {
      data.promotions.slice(0, 3).forEach((promo, idx) => {
        const prod = promo.product || (typeof promo.productId === 'object' ? promo.productId : null);
        if (prod) {
          list.push({
            id: `promo-${promo._id}`,
            tag: `${promo.discount}% RMF DISCOUNT`,
            title: prod.name,
            sub: prod.description || `Exclusive deal live in ${prod.categoryLabel || prod.category || 'RMF marketplace'}!`,
            color: idx % 3 === 0 ? '#ff6b00' : idx % 3 === 1 ? '#0066CC' : '#00A650',
            color2: idx % 3 === 0 ? '#e05300' : idx % 3 === 1 ? '#004EA6' : '#007A3D',
            productId: prod._id,
          });
        }
      });
    }

    // 2. Populate from trending products
    if (list.length < 3 && data?.trending && data.trending.length > 0) {
      data.trending.slice(0, 3 - list.length).forEach((prod, idx) => {
        const index = list.length;
        list.push({
          id: `trend-${prod._id}`,
          tag: 'TRENDING TODAY',
          title: prod.name,
          sub: prod.description || `Premium top-choice item from verified local vendors!`,
          color: index % 3 === 0 ? '#ff6b00' : index % 3 === 1 ? '#0066CC' : '#00A650',
          color2: index % 3 === 0 ? '#e05300' : index % 3 === 1 ? '#004EA6' : '#007A3D',
          productId: prod._id,
        });
      });
    }

    // 3. Dynamic Fallbacks
    const defaults = [
      { id: 'd1', tag: 'HARVEST SEASON', title: 'Farm-Fresh Deals', sub: 'Up to 45% OFF direct from verified Rwandan farms', color: '#ff6b00', color2: '#e05300' },
      { id: 'd2', tag: 'SECURE ESCROW', title: 'Buy with Escrow', sub: 'Every order is protected until you confirm safe delivery', color: '#0066CC', color2: '#004EA6' },
      { id: 'd3', tag: 'BEST SELLERS', title: 'Kimironko Premium', sub: 'Top-rated spices, textiles & handcrafts. Same-day delivery', color: '#00A650', color2: '#007A3D' },
    ];
    while (list.length < 3) {
      list.push(defaults[list.length]);
    }

    return list;
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setBannerIdx(i => (i + 1) % dynamicBanners.length), 4000);
    return () => clearInterval(t);
  }, [dynamicBanners.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
        return { h: 5, m: 59, s: 59 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const markets = data?.markets || [];
  const categories = data?.categories || [];
  const promoted = useMemo(
    () => (data?.promotions || []).map(productFromPromotion).filter(Boolean) as Product[],
    [data?.promotions],
  );
  const topMarkets = useMemo(
    () => [...markets].sort((a, b) => (b.totalSellers || 0) - (a.totalSellers || 0)).slice(0, 8),
    [markets],
  );
  const filteredProducts = useMemo(() => {
    const src = data?.recommended?.length ? data.recommended : data?.trending || [];
    if (!activeCategory) return src;
    return src.filter(p => p.categoryId === activeCategory || p.category === activeCategory);
  }, [activeCategory, data]);

  const handleQuickAction = (id: string) => {
    if (id === 'deals') router.push({ pathname: '/products', params: { sort: 'deals' } } as any);
    else if (id === 'markets') router.push('/markets' as any);
    else if (id === 'videos') router.push('/videos' as any);
    else if (id === 'new') router.push({ pathname: '/products', params: { sort: 'popular' } } as any);
    else if (id === 'local') router.push('/products' as any);
    else if (id === 'deliver') router.push('/markets' as any);
    else if (id === 'promo') router.push({ pathname: '/products', params: { sort: 'deals' } } as any);
    else if (id === 'secure') router.push('/products' as any);
  };

  if (loading && !data) return <LoadingBlock label="Loading RMF marketplace..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const banner = dynamicBanners[bannerIdx];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={[styles.banner, { backgroundColor: banner.color }]}>
        <View style={[styles.bannerBlob, { backgroundColor: banner.color2 }]} />
        <View style={styles.bannerLeft}>
          <View style={styles.bannerTag}>
            <Flame color="#fff" size={9} />
            <Text style={styles.bannerTagText}>{banner.tag}</Text>
          </View>
          <Text style={styles.bannerTitle}>{banner.title}</Text>
          <Text style={styles.bannerSub}>{banner.sub}</Text>
          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => {
              if (banner.productId) {
                router.push(`/product/${banner.productId}` as any);
              } else {
                router.push('/products' as any);
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.bannerBtnText}>Shop Now</Text>
            <ArrowRight color={banner.color} size={12} />
          </TouchableOpacity>
        </View>
        <View style={styles.bannerDots}>
          {dynamicBanners.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setBannerIdx(i)}>
              <View style={[styles.dot, i === bannerIdx && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <TouchableOpacity
              key={action.id}
              style={styles.quickItem}
              onPress={() => handleQuickAction(action.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIcon, { backgroundColor: action.bg }]}>
                <Icon color={action.color} size={22} strokeWidth={1.8} />
                {action.badge ? (
                  <View style={[styles.quickBadge, { backgroundColor: action.color }]}>
                    <Text style={styles.quickBadgeText}>{action.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Zap color="#E02020" fill="#E02020" size={16} />
            <Text style={styles.sectionTitle}>Flash Deals</Text>
            <View style={styles.countdown}>
              <TimeBox value={pad(countdown.h)} />
              <Text style={styles.colon}>:</Text>
              <TimeBox value={pad(countdown.m)} />
              <Text style={styles.colon}>:</Text>
              <TimeBox value={pad(countdown.s)} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.seeAll}
            onPress={() => router.push({ pathname: '/products', params: { sort: 'deals' } } as any)}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight color={colors.primary} size={13} />
          </TouchableOpacity>
        </View>

        {promoted.length ? (
          <FlatList
            horizontal
            data={promoted.slice(0, 10)}
            keyExtractor={item => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRail}
            renderItem={({ item }) => {
              const hash = (item._id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const claimedPercent = Math.min(95, Math.max(15, 35 + (hash % 50)));
              return (
                <View style={styles.dealWrap}>
                  <ProductCard
                    product={item}
                    style={{ width: 130 }}
                    onPress={() => router.push(`/product/${item._id}` as any)}
                  />
                  <View style={styles.claimedBar}>
                    <View style={[styles.claimedFill, { width: `${claimedPercent}%` }]} />
                  </View>
                  <Text style={styles.claimedLabel}>{claimedPercent}% claimed</Text>
                </View>
              );
            }}
          />
        ) : (
          <EmptyInline title="No live flash deals" body="Deals appear when sellers add promotions." />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <MapPinned color={colors.primary} size={16} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Top Markets</Text>
          </View>
          <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/markets' as any)}>
            <Text style={styles.seeAllText}>Browse all</Text>
            <ChevronRight color={colors.primary} size={13} />
          </TouchableOpacity>
        </View>

        {topMarkets.length ? (
          <FlatList
            horizontal
            data={topMarkets}
            keyExtractor={item => idOf(item) || item.name}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRail}
            renderItem={({ item, index }) => (
              <MarketCard
                market={item}
                rank={index + 1}
                style={{ width: 200 }}
                onPress={() => {
                  const id = idOf(item);
                  if (id) router.push(`/market/${id}` as any);
                }}
              />
            )}
          />
        ) : (
          <EmptyInline title="No markets available" body="Markets appear after seeding." />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Video color={colors.primary} size={16} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Seller Videos</Text>
          </View>
          <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/videos' as any)}>
            <Text style={styles.seeAllText}>Watch all</Text>
            <ChevronRight color={colors.primary} size={13} />
          </TouchableOpacity>
        </View>
        <SellerVideoFeed compact />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Sparkles color={colors.gold} size={16} />
            <Text style={styles.sectionTitle}>Just For You</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <CategoryChip label="All" active={!activeCategory} onPress={() => setActiveCategory(null)} />
          {categories.slice(0, 14).map(cat => (
            <CategoryChip
              key={cat.id}
              label={cat.label}
              active={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>

        {filteredProducts.length ? (
          <View style={styles.productGrid}>
            {filteredProducts.slice(0, 30).map(item => (
              <ProductCard
                key={item._id}
                product={item}
                compact
                onPress={() => router.push(`/product/${item._id}` as any)}
              />
            ))}
          </View>
        ) : (
          <EmptyInline title="No products yet" body="Recommendations load after orders are placed." />
        )}

        {filteredProducts.length >= 30 && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => router.push('/products' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.loadMoreText}>View all products</Text>
            <ArrowRight color={colors.primary} size={14} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function TimeBox({ value }: { value: string }) {
  return (
    <View style={styles.timeBox}>
      <Text style={styles.timeText}>{value}</Text>
    </View>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyInline({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyInline}>
      <ShoppingBag color={colors.primary} size={20} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 100 },
  banner: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    minHeight: 140,
    overflow: 'hidden',
    ...shadowMd,
  },
  bannerBlob: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.3,
  },
  bannerLeft: { gap: 6, maxWidth: '80%' },
  bannerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bannerTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  bannerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '500', lineHeight: 17 },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  bannerBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  bannerDots: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 14 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderTopWidth: 0.5,
    borderColor: colors.divider,
  },
  quickItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  quickBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900' },
  quickLabel: {
    color: colors.body,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 },
  timeBox: {
    backgroundColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  timeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  colon: { color: colors.ink, fontWeight: '900', fontSize: 11 },
  hRail: { paddingHorizontal: 12, gap: 8 },
  dealWrap: { gap: 5 },
  claimedBar: {
    height: 3,
    backgroundColor: '#FFE0D6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  claimedFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  claimedLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  chips: { paddingHorizontal: 12, gap: 7 },
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#FFF0EB',
    borderColor: colors.primary,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    rowGap: 8,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
  },
  loadMoreText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  emptyInline: {
    minHeight: 90,
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
