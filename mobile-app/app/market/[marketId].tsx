import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { BadgeCheck, Clock, FileText, MapPin, Phone, Search, ShieldCheck, SlidersHorizontal, Star, Store, Tag, Play, Video, ArrowLeft, Flame } from 'lucide-react-native';
import { MarketCard, ProductCard } from '../../src/components/Cards';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api, orderSocketUrl } from '../../src/lib/api';
import { formatDateTime, money } from '../../src/lib/format';
import { asArray, normalizeMarketImageUrl, idOf } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Market, Product, Promotion, SellerVideo } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';
import { useOrderSocket } from '../../src/hooks/useOrderSocket';

type Review = { _id: string; rating: number; comment?: string; buyerName?: string; createdAt?: string };

const Stars = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={12} color={colors.orange} fill={i <= Math.round(rating) ? colors.orange : 'transparent'} />
    ))}
  </View>
);

type MarketTab = 'shop' | 'videos' | 'about' | 'reviews';

type MarketPayload = {
  market: Market | null;
  markets: Market[];
  products: Product[];
  categories: CatalogCategory[];
  promotions: Promotion[];
  adVideos: SellerVideo[];
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
      adVideos: [],
    };
  }

  const market = await api.get<Market>('market', `/markets/${marketId}`, { auth: false })
    .catch(() => api.get<Market>('market', `/markets/slug/${marketId}`, { auth: false }));
  const [products, categories, promotions, adVideos] = await Promise.all([
    api.get<Product[]>('product', `/products?marketId=${encodeURIComponent(market._id)}&isActive=true&limit=90&sortBy=-totalOrders`, { auth: false }),
    categoriesPromise,
    api.get<Promotion[]>('product', `/promotions/active?marketId=${encodeURIComponent(market._id)}`, { auth: false }).catch(() => []),
    api.get<SellerVideo[]>('product', `/seller-videos?marketId=${encodeURIComponent(market._id)}&placement=SHOP_AD&limit=5`, { auth: false })
      .catch(() => [] as SellerVideo[])
      .then(async (res) => {
        const ads = asArray<SellerVideo>(res);
        if (ads.length > 0) return ads;
        // Fallback
        const fallbackRes = await api.get<SellerVideo[]>('product', `/seller-videos?marketId=${encodeURIComponent(market._id)}&limit=5`, { auth: false }).catch(() => []);
        return asArray<SellerVideo>(fallbackRes);
      }),
  ]);
  return {
    market,
    markets: [],
    products: asArray(products),
    categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
    promotions: asArray(promotions),
    adVideos,
  };
};

export default function MarketScreen() {
  const router = useRouter();
  const { marketId } = useLocalSearchParams<{ marketId: string }>();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [marketDistrict, setMarketDistrict] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeTab, setActiveTab] = useState<MarketTab>('shop');

  // Reset filters when marketId changes
  useEffect(() => {
    setSearch('');
    setCategoryId(null);
    setOnlyDeals(false);
    setMinPrice('');
    setMaxPrice('');
    setActiveTab('shop');
  }, [marketId]);

  const { data, loading, refreshing, error, refresh } = useRemote(() => loadMarket(String(marketId || 'all')), [marketId]);

  const { data: reviews } = useRemote<Review[]>(
    () => data?.market?._id
      ? api.get<Review[]>('product', `/reviews/target/market/${data.market._id}`).catch(() => [])
      : Promise.resolve([]),
    [data?.market?._id],
  );

  // Listen for real-time seller order updates to refetch market catalog ranks
  const { payload: socketMsg } = useOrderSocket('order:seller:updates', orderSocketUrl());
  useEffect(() => {
    if (socketMsg) {
      console.log('[WebSocket] Order update received on Mobile Market Page:', socketMsg);
      if (socketMsg.type === 'STATUS_UPDATE' && (socketMsg.status === 'delivered' || socketMsg.status === 'confirmed')) {
        refresh();
      }
    }
  }, [socketMsg, refresh]);

  const products = data?.products || [];
  const markets = data?.markets || [];
  const categories = data?.categories || [];
  const promotions = data?.promotions || [];
  const adVideos = data?.adVideos || [];
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
      const min = minPrice ? Number(product.price || 0) >= Number(minPrice) : true;
      const max = maxPrice ? Number(product.price || 0) <= Number(maxPrice) : true;
      return (!needle || text.includes(needle))
        && (!categoryId || product.categoryId === categoryId || product.productType === categoryId)
        && (!onlyDeals || promoIds.has(product._id) || Boolean(product.promotion))
        && min && max;
    });
  }, [categoryId, minPrice, maxPrice, onlyDeals, products, promoIds, search]);

  const promotedProducts = promotions.map(promoProduct).filter(Boolean).filter(product => {
    if (!data?.market) return true;
    const productMarket = typeof product!.marketId === 'object' ? product!.marketId?._id : product!.marketId;
    return !productMarket || productMarket === data.market._id;
  }) as Product[];

  const maxDiscount = useMemo(() => {
    if (!promotions || promotions.length === 0) return 0;
    return Math.max(...promotions.map(p => p.discount || 0));
  }, [promotions]);

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
            <MarketCard key={market._id} market={market} compact onPress={() => router.push(`/market/${market._id}`)} />
          )) : <EmptyBlock title="No markets match" body="Try another search or district." />}
        </View>
      </ScrollView>
    );
  }

  const market = data.market;
  const reviewList = asArray<Review>(reviews);

  const TABS: { id: MarketTab; label: string; count?: number }[] = [
    { id: 'shop', label: 'Shop', count: filteredProducts.length },
    { id: 'videos', label: 'Videos' },
    { id: 'about', label: 'About' },
    { id: 'reviews', label: 'Reviews', count: reviewList.length },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── Hero ────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {market.imageUrl ? <Image source={{ uri: normalizeMarketImageUrl(market.imageUrl) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
          <View style={styles.heroOverlay} />
          {/* Floating Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <ArrowLeft color={colors.ink} size={18} />
          </TouchableOpacity>
          <View style={styles.heroBody}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={styles.marketType}>{market.type || market.code || 'Market'}</Text>
            {maxDiscount > 0 ? (
              <View style={[styles.marketPromoBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Flame size={12} color={colors.card} fill={colors.card} />
                <Text style={styles.marketPromoBadgeText}>Up to {maxDiscount}% OFF</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{market.name}</Text>
          <View style={styles.heroMeta}>
            <MapPin color={colors.orange} size={15} />
            <Text style={styles.heroMetaText}>{market.location?.address || market.location?.district || 'Location managed by RMF'}</Text>
          </View>
        </View>
        {adVideos.length > 0 ? (
          <TouchableOpacity style={styles.glassAdCard} onPress={() => setActiveTab('videos')} activeOpacity={0.85}>
            <View style={styles.glassPlayBtn}><Play color={colors.card} fill={colors.card} size={10} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.glassAdTitle} numberOfLines={1}>{adVideos[0].title}</Text>
              <Text style={styles.glassAdTag}>Shop Video Ad</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Stat row ──────────────────────────────────────────── */}
      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Store color={colors.orange} size={18} />
          <Text style={styles.infoValue}>{market.totalSellers || 0}</Text>
          <Text style={styles.infoLabel}>Sellers</Text>
        </View>
        <View style={styles.infoCard}>
          <Clock color={colors.orange} size={18} />
          <Text style={styles.infoValue}>{market.operatingHours?.open || '--'} – {market.operatingHours?.close || '--'}</Text>
          <Text style={styles.infoLabel}>Hours</Text>
        </View>
        {(market as any).phone ? (
          <TouchableOpacity style={styles.infoCard} onPress={() => Linking.openURL(`tel:${(market as any).phone}`)}>
            <Phone color={colors.orange} size={18} />
            <Text style={styles.infoValue} numberOfLines={1}>{(market as any).phone}</Text>
            <Text style={styles.infoLabel}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Tabs (matches web Shop/Videos/About/Reviews) ──────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Shop tab ──────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <>
          {promotedProducts.length ? (
            <Section title="Promotions" meta={`${promotedProducts.length} deals`}>
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
                    <TouchableOpacity style={styles.promoCard} onPress={() => {
                      const pId = idOf(product);
                      if (pId) router.push(`/product/${pId}`);
                    }} activeOpacity={0.88}>
                      <View style={styles.promoTop}><Tag color={colors.orangeDark} size={14} /><Text style={styles.promoText}>{item.discount || 0}% off</Text></View>
                      <Text style={styles.promoTitle} numberOfLines={2}>{product.name}</Text>
                      <Text style={styles.promoPrice}>{money(item.promotedPrice || product.price)}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </Section>
          ) : null}

          <View style={styles.filterPanel}>
            <View style={styles.searchBar}>
              <Search color={colors.orange} size={17} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={colors.faint} style={styles.searchInput} />
              {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: colors.faint }}>✕</Text></TouchableOpacity> : null}
            </View>
            {/* Price range (matches web) */}
            <View style={styles.priceRow}>
              <TextInput value={minPrice} onChangeText={setMinPrice} placeholder="Min RWF" placeholderTextColor={colors.faint} keyboardType="numeric" style={styles.priceInput} />
              <Text style={styles.priceSep}>–</Text>
              <TextInput value={maxPrice} onChangeText={setMaxPrice} placeholder="Max RWF" placeholderTextColor={colors.faint} keyboardType="numeric" style={styles.priceInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <FilterChip label="All" active={!categoryId && !onlyDeals} onPress={() => { setCategoryId(null); setOnlyDeals(false); }} />
              <FilterChip label="Deals" active={onlyDeals} onPress={() => setOnlyDeals(c => !c)} />
              {categories.map(cat => (
                <FilterChip key={cat.id} label={cat.label} active={categoryId === cat.id} onPress={() => setCategoryId(c => c === cat.id ? null : cat.id)} />
              ))}
            </ScrollView>
          </View>

          <Section title="Market shelf" meta={`${filteredProducts.length} items`}>
            {filteredProducts.length ? (
              <View style={styles.grid}>
                {filteredProducts.map(product => {
                  const pId = idOf(product);
                  return (
                    <ProductCard key={product._id} product={product} compact onPress={() => pId && router.push(`/product/${pId}`)} />
                  );
                })}
              </View>
            ) : (
              <EmptyBlock title="No products match" body="Try a different search or filter." />
            )}
          </Section>
        </>
      )}

      {/* ── Videos tab ────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <Section title="Seller videos" meta="Shop adverts and demos">
          <SellerVideoFeed marketId={market._id} compact />
        </Section>
      )}

      {/* ── About tab (matches web About section) ─────────────── */}
      {activeTab === 'about' && (
        <View style={styles.filterPanel}>
          <View style={styles.aboutCard}>
            <View style={styles.aboutHeader}>
              <BadgeCheck color={colors.orange} size={18} />
              <Text style={styles.aboutTitle}>About {market.name}</Text>
            </View>
            <Text style={styles.description}>{market.description || 'A verified RMF local trading hub connecting merchants with buyers.'}</Text>

            <View style={styles.aboutFacts}>
              {[
                { label: 'Address', value: market.location?.address || 'Kigali, Rwanda' },
                { label: 'Operating days', value: (market.operatingHours as any)?.daysOpen?.join(', ') || 'Monday – Sunday' },
                { label: 'Hours', value: market.operatingHours?.open && market.operatingHours?.close ? `${market.operatingHours.open} – ${market.operatingHours.close}` : '6:00 AM – 6:00 PM' },
                { label: 'Registered sellers', value: String(market.totalSellers || 0) },
                { label: 'Active products', value: String((market as any).activeProducts || products.length) },
              ].map((fact, idx) => (
                <View key={idx} style={styles.factRow}>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                  <Text style={styles.factValue}>{fact.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.buyerProtection}>
              <ShieldCheck color={colors.orange} size={16} />
              <Text style={styles.buyerProtectionText}>Buyer protection active — payments stay traceable until delivery confirmed.</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Reviews tab ───────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <View style={styles.filterPanel}>
          {reviewList.length ? reviewList.map(review => (
            <View key={review._id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Stars rating={review.rating} />
                <Text style={styles.reviewerName}>{review.buyerName || 'Verified buyer'}</Text>
              </View>
              {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              <Text style={styles.reviewTime}>{review.createdAt ? formatDateTime(review.createdAt) : ''}</Text>
            </View>
          )) : (
            <EmptyBlock title="No reviews yet" body="Reviews appear after completed orders from this market." />
          )}
        </View>
      )}
    </ScrollView>
    </View>
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
  // Tabs
  tabStrip: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.card },
  tabActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.orangeDark, fontWeight: '900' },
  // Price range
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 10, color: colors.ink, fontSize: 12 },
  priceSep: { color: colors.faint, fontWeight: '900' },
  // About
  aboutCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 12 },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aboutTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', flex: 1 },
  aboutFacts: { gap: 8 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  factLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  factValue: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'right', flex: 1 },
  buyerProtection: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.orangeSoft, borderRadius: 8, padding: 10 },
  buyerProtectionText: { flex: 1, color: colors.orangeDark, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  // Reviews
  reviewCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14, gap: 6 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  reviewComment: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  reviewTime: { color: colors.faint, fontSize: 10, fontWeight: '700' },
  listContent: { padding: 16, gap: 16, paddingBottom: 36 },
  listHero: { borderRadius: 16, backgroundColor: colors.orangeDark, padding: 18, gap: 7 },
  title: { color: colors.card, fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  marketList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  hero: { height: 260, backgroundColor: colors.orangeDark },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3, zIndex: 20 },
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
  grid: { paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  marketPromoBadge: {
    backgroundColor: colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  marketPromoBadgeText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  glassAdCard: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 170,
    backgroundColor: 'rgba(27, 28, 28, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  glassPlayBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAdTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  glassAdTag: {
    color: '#ffedd5',
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
