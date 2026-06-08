import React, { useMemo, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, Modal,
  Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
  ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Check, Heart, MessageCircle, Minus, Play, Plus, Share2, ShieldCheck, ShoppingBag, Star, Store,
  MapPin, Lock, Truck, Shield
} from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money, safeText } from '../../src/lib/format';
import { asArray, imageOf, productToCartItem, sellerProfileOf, normalizeImageUrl, normalizeMediaUrl, idOf, imagesOfVariant } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { OrderMessage, Product, ProductVariant } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';
import { useAuth } from '../../src/context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  buyer?: { fullName?: string };
};

const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        size={size}
        color={colors.orange}
        fill={i <= Math.round(rating) ? colors.orange : 'transparent'}
      />
    ))}
  </View>
);

const variantVideoHtml = (rawUrl?: string | null) => {
  const src = JSON.stringify(normalizeMediaUrl(rawUrl) || '');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000}button{position:fixed;inset:0;border:0;background:transparent;color:#fff;font-size:38px}</style></head><body><video id="v" src=${src} controls playsinline webkit-playsinline preload="auto"></video><button id="p">▶</button><script>const v=document.getElementById('v');const p=document.getElementById('p');const play=()=>{v.play().then(()=>p.style.display='none').catch(()=>p.style.display='flex')};p.onclick=play;v.onclick=()=>{if(v.paused)play();else{v.pause();p.style.display='flex'}};play();</script></body></html>`;
};

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { items, addItem } = useCart();
  const { user } = useAuth();
  
  const [qty, setQty] = useState(1);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [variantVideoUrl, setVariantVideoUrl] = useState<string | null>(null);
  const [negotiating, setNegotiating] = useState(false);

  const { data: product, loading, error, refresh } = useRemote<Product>(
    () => api.get<Product>('product', `/products/${productId}`, { auth: false }),
    [productId],
  );

  const { data: reviews } = useRemote<Review[]>(
    () => productId ? api.get<Review[]>('product', `/products/${productId}/reviews`).catch(() => []) : Promise.resolve([]),
    [productId],
  );

  const variants = useMemo(() => asArray<ProductVariant>(product?.variants).filter(item => item.isActive !== false), [product?.variants]);
  const selectedVariant = variants.length > 0 ? variants[selectedVariantIndex] : undefined;
  const seller = product ? sellerProfileOf(product) : null;
  const isNegotiable = String(product?.isNegotiable) === 'true' || product?.isNegotiable === true;

  // Get active variant images normalized
  const variantImages = useMemo(() => {
    return imagesOfVariant(selectedVariant);
  }, [selectedVariant]);

  // Get base product images normalized
  const productImages = useMemo(() => {
    if (!product) return [];
    return (product.images?.length ? product.images : [imageOf(product)])
      .map(normalizeImageUrl)
      .filter(Boolean) as string[];
  }, [product]);

  // Merge so that active variant's images are shown first, followed by other images
  const galleryImages = useMemo(() => {
    if (variantImages.length > 0) {
      return [...new Set([...variantImages, ...productImages])];
    }
    return productImages;
  }, [variantImages, productImages]);

  const displayedImage = galleryImages[activeImageIndex] || 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500';

  const basePrice = Number(product?.price || 0);
  const markupPrice = selectedVariant?.price !== undefined && selectedVariant?.price !== null
    ? Number(selectedVariant.price)
    : 0;
  const effectivePrice = basePrice + markupPrice;
  const refMoney = (amount: number) => `RWF  ${Math.round(amount || 0).toLocaleString()}`;
  const effectiveUnit = selectedVariant?.unit || product?.unit || 'piece';
  const effectiveStockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const inStock = selectedVariant?.inStock ?? product?.inStock;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const avgRating = useMemo(() => {
    const r = asArray<Review>(reviews);
    if (!r.length) return 0;
    return r.reduce((sum, rev) => sum + (rev.rating || 0), 0) / r.length;
  }, [reviews]);

  React.useEffect(() => {
    if (!product?._id) return;
    api.post('product', `/products/${product._id}/interactions`, { action: 'product_view' }).catch(() => undefined);
  }, [product?._id]);

  React.useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedVariantIndex]);

  const handleAddToCart = () => {
    if (!product) return;
    if (variants.length > 0 && selectedVariantIndex === -1) {
      Alert.alert('Select variant', 'Please choose a product variant before adding to cart.');
      return;
    }
    try {
      addItem(productToCartItem(product, qty, selectedVariantIndex));
      api.post('product', `/products/${product._id}/interactions`, { action: 'add_to_cart' }).catch(() => undefined);
      router.push('/cart');
    } catch (err) {
      Alert.alert('Cannot add item', err instanceof Error ? err.message : 'This product is not orderable yet.');
    }
  };

  const handleStartNegotiation = async () => {
    if (!product) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to negotiate prices with the merchant.');
      return;
    }
    const role = String(user.role || (user as any).userRole || '').toUpperCase();
    if (role !== 'BUYER') {
      Alert.alert('Buyer account required', 'Only buyer accounts can initiate price negotiations.');
      return;
    }

    setNegotiating(true);
    try {
      const subtotal = effectivePrice * qty;
      const deliveryFee = 1000;
      const platformCommission = Math.max(subtotal * 0.015, 100);
      const gatewayFee = Math.ceil(subtotal * 0.02);
      const totalAmount = subtotal + deliveryFee + gatewayFee;
      
      const sellerProfile = sellerProfileOf(product);
      const sellerUserId = typeof sellerProfile?.userId === 'string' ? sellerProfile.userId : idOf(sellerProfile?.userId);

      const payload = {
        buyer: {
          userId: user.id || (user as any)._id,
          fullName: user.fullName || 'Buyer',
          phone: user.phone || 'N/A',
        },
        seller: {
          sellerId: idOf(product.sellerId),
          userId: sellerUserId || null,
          fullName: sellerProfile?.shopDetails?.name || sellerProfile?.stallName || 'Seller',
          stallId: sellerProfile?.stallId || 'N/A',
          marketId: idOf(product.marketId),
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: effectivePrice,
          quantity: qty,
          unit: effectiveUnit,
          category: product.category,
          categoryId: product.categoryId,
          imageUrl: displayedImage || product.images?.[0],
          images: galleryImages,
          attributes: selectedVariant?.attributes || product.attributes,
          variantId: selectedVariant?.id || selectedVariant?.sku,
          variantTitle: selectedVariant?.title,
          sellerSku: selectedVariant?.sku,
          priceSnapshotAt: product.priceUpdatedAt,
        }],
        financials: {
          subtotal,
          deliveryFee,
          platformCommission,
          gatewayFee,
          totalAmount,
          sellerPayout: subtotal - platformCommission,
          riderPayout: 900,
        },
        payment: { method: 'MTN_MOMO' },
        attributes: {
          isQuoteRequest: 'true',
          isCustomizable: 'false'
        },
        notes: `Negotiation started for ${product.name}`,
      };

      const response = await api.post<any>('order', '/orders', payload);
      const order = response?.data || response;
      Alert.alert(
        'Negotiation started',
        'Your quote request has been placed! The merchant has been notified. Redirecting to your orders...',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/orders' as any);
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert(
        'Failed to start negotiation',
        err instanceof Error ? err.message : 'Unable to create negotiation order at this time.'
      );
    } finally {
      setNegotiating(false);
    }
  };

  const toggleWishlist = async () => {
    if (!product) return;
    if (!user) { Alert.alert('Sign in required', 'Please sign in to save products to your wishlist.'); return; }
    const next = !wishlisted;
    setWishlisted(next);
    try {
      await api.post('user', next ? '/users/wishlist' : '/users/wishlist/remove', { productId: product._id });
      if (next) api.post('product', `/products/${product._id}/interactions`, { action: 'wishlist' }).catch(() => undefined);
    } catch (err) {
      setWishlisted(!next);
      Alert.alert('Wishlist error', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  if (loading && !product) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#a63f00" />
      </View>
    );
  }
  if (error && !product) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!product) return <EmptyBlock title="Product not found" body="The product service did not return this item." />;

  const reviewList = asArray<Review>(reviews);
  const sellerName = seller?.shopDetails?.name || seller?.stallName || (product as any).sellerName || 'Verified RMF seller';
  const minOrder = Number((selectedVariant as any)?.minOrderQuantity || (product as any)?.minOrderQuantity || 1);
  const ratingValue = avgRating || Number((product as any).rating || 0);
  const reviewCount = reviewList.length || Number((product as any).reviewCount || (product as any).totalReviews || 0);
  const specRows = [
    { label: 'ORIGIN', value: (product as any).origin || (seller as any)?.marketName || product.categoryLabel || 'Rwanda' },
    { label: 'UNIT', value: effectiveUnit },
    { label: 'QUALITY', value: (product as any).qualityGrade || (product as any).quality || 'Seller marked' },
    { label: 'STOCK', value: effectiveStockQuantity ? `${effectiveStockQuantity} ${effectiveUnit}` : inStock ? 'Available' : 'Out of stock' },
  ];

  return (
    <View style={styles.refScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.refTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.refIconBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft color={colors.ink} size={24} />
        </TouchableOpacity>
        <View style={styles.refTopActions}>
          <TouchableOpacity
            style={styles.refIconBtn}
            onPress={() => Share.share({ message: `${product.name} on RMF` }).catch(() => undefined)}
            activeOpacity={0.8}
          >
            <Share2 color={colors.ink} size={22} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refIconBtn} onPress={toggleWishlist} activeOpacity={0.8}>
            <Heart color={wishlisted ? colors.primary : colors.ink} fill={wishlisted ? colors.primary : 'transparent'} size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.refScroll}>
        <View style={styles.refImageStage}>
          <Image source={{ uri: displayedImage }} style={styles.refHeroImage} resizeMode="contain" />
          <View style={styles.refDots}>
            {galleryImages.slice(0, 4).map((_, idx) => (
              <TouchableOpacity
                key={`dot-${idx}`}
                style={[styles.refDot, activeImageIndex === idx && styles.refDotActive]}
                onPress={() => setActiveImageIndex(idx)}
                activeOpacity={0.85}
              />
            ))}
          </View>
        </View>

        <View style={styles.refInfoBlock}>
          <View style={styles.refTags}>
            {(product as any).isMadeInRwanda !== false && (
              <View style={styles.refTag}>
                <View style={styles.refTagDot} />
                <Text style={styles.refTagText}>MADE IN RWANDA</Text>
              </View>
            )}
            {isNegotiable && (
              <View style={styles.refTagMuted}>
                <MessageCircle color={colors.body} size={13} />
                <Text style={styles.refTagText}>NEGOTIABLE</Text>
              </View>
            )}
          </View>

          <Text style={styles.refProductTitle}>{product.name}</Text>
          <TouchableOpacity
            style={styles.refSellerLine}
            onPress={() => {
              const marketId = idOf(seller?.marketId) || idOf(product.marketId);
              if (marketId) router.push(`/market/${marketId}` as any);
            }}
            activeOpacity={0.85}
          >
            <Store color={colors.body} size={17} />
            <Text style={styles.refSellerText}>{sellerName}</Text>
          </TouchableOpacity>

          <View style={styles.refPriceRow}>
            <View>
              <Text style={styles.refCaps}>BASE PRICE</Text>
              <View style={styles.refPriceInline}>
                <Text style={styles.refPrice}>{refMoney(effectivePrice)}</Text>
                <Text style={styles.refUnit}>/ {effectiveUnit}</Text>
              </View>
            </View>
            <View style={styles.refMinOrder}>
              <Text style={styles.refCaps}>MIN ORDER</Text>
              <Text style={styles.refMono}>{minOrder} {effectiveUnit}</Text>
            </View>
          </View>
        </View>

        <View style={styles.refSection}>
          <View style={styles.refSectionHeader}>
            <Text style={styles.refCapsDark}>ROAST PROFILE</Text>
            <Text style={styles.refSpecsLink}>Specs</Text>
          </View>
          <View style={styles.refVariantGrid}>
            {(variants.length ? variants.slice(0, 3) : [{ title: selectedVariant?.title || 'Standard' } as ProductVariant]).map((variant, index) => {
              const selected = variants.length ? selectedVariantIndex === index : true;
              return (
                <TouchableOpacity
                  key={`${variant.title || 'variant'}-${index}`}
                  style={[styles.refVariantBtn, selected && styles.refVariantBtnActive]}
                  onPress={() => variants.length && setSelectedVariantIndex(index)}
                  activeOpacity={0.85}
                >
                  {selected && <View style={styles.refVariantDot} />}
                  <Text style={[styles.refVariantText, selected && styles.refVariantTextActive]} numberOfLines={1}>
                    {variant.title || variant.sku || `Option ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.refCapsDark, { marginTop: 18 }]}>QUANTITY ({effectiveUnit.toUpperCase()})</Text>
          <View style={styles.refQtyBox}>
            <TouchableOpacity style={styles.refQtyBtn} onPress={() => setQty(prev => Math.max(1, prev - 1))} activeOpacity={0.85}>
              <Minus color={colors.ink} size={18} />
            </TouchableOpacity>
            <Text style={styles.refQtyValue}>{qty}</Text>
            <TouchableOpacity style={styles.refQtyBtn} onPress={() => setQty(prev => prev + 1)} activeOpacity={0.85}>
              <Plus color={colors.ink} size={18} />
            </TouchableOpacity>
          </View>
          <Text style={styles.refTotal}>Total: {refMoney(effectivePrice * qty)}</Text>
        </View>

        <View style={styles.refSectionWhite}>
          <Text style={styles.refCapsDark}>PRODUCT SPECIFICATIONS</Text>
          <View style={styles.refSpecsGrid}>
            {specRows.map((row, index) => (
              <View key={row.label} style={[styles.refSpecCell, index > 1 && styles.refSpecCellTop]}>
                <Text style={styles.refSpecLabel}>{row.label}</Text>
                <Text style={styles.refSpecValue} numberOfLines={2}>{String(row.value)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.refDescription}>{product.description || 'Seller has not added a detailed product description yet.'}</Text>
        </View>

        <View style={styles.refSection}>
          <View style={styles.refReviewHeader}>
            <View>
              <Text style={styles.refReviewScore}>{ratingValue ? ratingValue.toFixed(1) : '0.0'}</Text>
              <Stars rating={ratingValue || 0} size={15} />
            </View>
            <Text style={styles.refCapsDark}>{reviewCount} REVIEWS</Text>
          </View>
          <View style={styles.refRatingBars}>
            {[5, 4, 3].map((star, index) => (
              <View key={star} style={styles.refRatingBarRow}>
                <Text style={styles.refRatingNo}>{star}</Text>
                <Star color={colors.body} size={12} />
                <View style={styles.refRatingTrack}>
                  <View style={[styles.refRatingFill, { width: `${index === 0 ? 80 : index === 1 ? 30 : 8}%` }]} />
                </View>
              </View>
            ))}
          </View>
          {reviewList[0] ? (
            <View style={styles.refReviewCard}>
              <View style={styles.refReviewTop}>
                <View style={styles.refAvatar}>
                  <Text style={styles.refAvatarText}>{(reviewList[0].buyer?.fullName || 'VB').slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.refReviewName}>{reviewList[0].buyer?.fullName || 'Verified buyer'}</Text>
                <Text style={styles.refReviewDate}>{formatDateTime(reviewList[0].createdAt).split(',')[0]}</Text>
              </View>
              <Text style={styles.refReviewText} numberOfLines={3}>{reviewList[0].comment || 'Verified purchase review.'}</Text>
            </View>
          ) : (
            <View style={styles.refReviewCard}>
              <Text style={styles.refReviewText}>No customer ratings submitted yet for this product.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.refBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.refNegotiateBtn, !isNegotiable && styles.refDisabledBtn]}
          onPress={handleStartNegotiation}
          disabled={!isNegotiable || negotiating}
          activeOpacity={0.88}
        >
          <MessageCircle color={colors.ink} size={18} />
          <Text style={styles.refNegotiateText}>{negotiating ? 'STARTING' : 'NEGOTIATE'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.refCartBtn, !inStock && styles.refDisabledBtn]}
          onPress={handleAddToCart}
          disabled={!inStock}
          activeOpacity={0.9}
        >
          <ShoppingBag color={colors.card} size={18} />
          <Text style={styles.refCartText}>ADD TO CART</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  refScreen: { flex: 1, backgroundColor: colors.surface },
  refTopBar: {
    minHeight: 64,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(251,249,248,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighest,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  refIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  refTopActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refScroll: { paddingBottom: 106 },
  refImageStage: {
    width: '100%',
    height: SCREEN_W,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  refHeroImage: { width: '94%', height: '94%' },
  refDots: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  refDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.divider },
  refDotActive: { backgroundColor: colors.primaryMid },
  refInfoBlock: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingHorizontal: 16, paddingVertical: 18 },
  refTags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  refTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.surfaceHighest, backgroundColor: '#fffff8', paddingHorizontal: 10, paddingVertical: 5 },
  refTagMuted: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 5 },
  refTagDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryMid },
  refTagText: { color: colors.body, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.8 },
  refProductTitle: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginBottom: 8 },
  refSellerLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 22 },
  refSellerText: { flex: 1, color: colors.body, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  refPriceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  refCaps: { color: colors.body, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.8, marginBottom: 5 },
  refCapsDark: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.8 },
  refPriceInline: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  refPrice: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '900' },
  refUnit: { color: colors.body, fontSize: 16, fontWeight: '500' },
  refMinOrder: { alignItems: 'flex-end' },
  refMono: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  refSection: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingHorizontal: 16, paddingVertical: 20 },
  refSectionWhite: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingHorizontal: 16, paddingVertical: 20 },
  refSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  refSpecsLink: { color: colors.primary, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  refVariantGrid: { flexDirection: 'row', gap: 8 },
  refVariantBtn: { flex: 1, minHeight: 43, borderRadius: 4, borderWidth: 1, borderColor: colors.surfaceHighest, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, position: 'relative' },
  refVariantBtnActive: { borderColor: colors.primary, backgroundColor: colors.card },
  refVariantDot: { position: 'absolute', top: 5, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryMid },
  refVariantText: { color: colors.body, fontSize: 15, fontWeight: '500' },
  refVariantTextActive: { color: colors.ink },
  refQtyBox: { height: 49, marginTop: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.surfaceHighest, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center' },
  refQtyBtn: { width: 49, height: '100%', alignItems: 'center', justifyContent: 'center', borderColor: colors.surfaceHighest },
  refQtyValue: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 25, fontWeight: '900' },
  refTotal: { color: colors.body, fontSize: 14, fontWeight: '600', marginTop: 8 },
  refSpecsGrid: { marginTop: 12, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: 6, backgroundColor: colors.card, flexDirection: 'row', flexWrap: 'wrap', padding: 16 },
  refSpecCell: { width: '50%', minHeight: 62, paddingRight: 10 },
  refSpecCellTop: { borderTopWidth: 1, borderTopColor: colors.surfaceHighest, paddingTop: 14, marginTop: 8 },
  refSpecLabel: { color: colors.body, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  refSpecValue: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  refDescription: { color: colors.body, fontSize: 14, lineHeight: 21, fontWeight: '500', marginTop: 14 },
  refReviewHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  refReviewScore: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '900', marginBottom: 4 },
  refRatingBars: { gap: 8, marginBottom: 20 },
  refRatingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refRatingNo: { width: 12, color: colors.body, fontSize: 13, fontWeight: '700' },
  refRatingTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.surfaceHighest, overflow: 'hidden' },
  refRatingFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primaryMid },
  refReviewCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: 6, padding: 16, gap: 10 },
  refReviewTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refAvatar: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#d9c3ae', alignItems: 'center', justifyContent: 'center' },
  refAvatarText: { color: colors.primaryDark, fontSize: 10, fontWeight: '800' },
  refReviewName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  refReviewDate: { color: colors.body, fontSize: 12, fontWeight: '800' },
  refReviewText: { color: colors.body, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  refBottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(251,249,248,0.98)', borderTopWidth: 1, borderTopColor: colors.surfaceHighest, paddingTop: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  refNegotiateBtn: { flex: 1, height: 50, borderRadius: 6, borderWidth: 1, borderColor: colors.surfaceHighest, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  refNegotiateText: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  refCartBtn: { flex: 1.5, height: 50, borderRadius: 6, backgroundColor: colors.primaryMid, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  refCartText: { color: colors.card, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  refDisabledBtn: { opacity: 0.55 },
  container: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf8f5',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f1eee9',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoTxt: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  bagWrapper: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#a63f00',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#faf8f5',
  },
  badgeTxt: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  scrollContent: {
    paddingBottom: 400, // Large padding bottom to accommodate the fixed sheet overlay
  },
  imageGalleryContainer: {
    backgroundColor: '#9c380c', // Elegant studio terracotta orange base matching Image 4
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    position: 'relative',
  },
  mainProductImage: {
    width: SCREEN_W * 0.85,
    height: SCREEN_W * 0.55,
    resizeMode: 'contain',
  },
  floatingWishlist: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#ffffff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  thumbCard: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 4,
  },
  thumbCardActive: {
    borderColor: '#ffffff',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  galleryLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  detailsContainer: {
    padding: 24,
  },
  detailsHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 16,
  },
  descriptionWrapper: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  verticalHighlightBar: {
    width: 4,
    backgroundColor: '#a63f00',
    borderRadius: 2,
    marginRight: 16,
  },
  descriptionText: {
    flex: 1,
    fontSize: 13,
    color: '#414844',
    lineHeight: 20,
    fontWeight: '500',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  specItemCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  specCardLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
    letterSpacing: 1,
  },
  specCardVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  localOriginCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sellerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  localOriginLeft: {
    gap: 4,
  },
  localOriginSub: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  reviewCard: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#f1eee9', padding: 12, gap: 8, marginBottom: 10 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { color: '#8e9e95', fontSize: 11, fontWeight: '700' },
  reviewComment: { color: '#1b1c1c', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  reviewsEmptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyStar: {
    marginBottom: 8,
  },
  emptyReviewTxt: {
    fontSize: 12,
    color: '#8e9e95',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 380,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  bottomPanelScroll: {
    paddingBottom: 24,
  },
  bottomCat: {
    fontSize: 9,
    fontWeight: '900',
    color: '#a63f00',
    letterSpacing: 1.5,
  },
  bottomTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginTop: 4,
    marginBottom: 12,
  },
  bottomPriceCard: {
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bottomPriceVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  bottomPriceCur: {
    fontSize: 12,
    fontWeight: '900',
    color: '#a63f00',
    marginLeft: 3,
  },
  bottomPriceUnit: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  updatedDateTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  variantsBlock: {
    marginBottom: 16,
  },
  blockLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
    letterSpacing: 1,
    marginBottom: 8,
  },
  variantsList: {
    gap: 8,
  },
  variantRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  variantRowCardActive: {
    borderColor: '#a63f00',
    backgroundColor: '#fff7ed',
  },
  variantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPreviewCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  variantMeta: {
    gap: 2,
  },
  variantTitleTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  variantSkuTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
  },
  variantRight: {
    alignItems: 'flex-end',
  },
  variantPriceTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  variantMarkupTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#a63f00',
  },
  statusBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1eee9',
  },
  statusCol: {
    flex: 1,
  },
  statusColRight: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusValTxt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  stockQtyVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quantityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 6,
  },
  qtyPickerBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyTextVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
    paddingHorizontal: 12,
  },
  microBadgesCol: {
    flexDirection: 'row',
    gap: 4,
  },
  microBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  microBadgeTxt: {
    fontSize: 7,
    fontWeight: '900',
    color: '#1b1c1c',
  },
  primaryCta: {
    backgroundColor: '#a63f00',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a63f00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  primaryCtaTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  videoModal: { flex: 1, backgroundColor: '#000' },
  videoCloseButton: { position: 'absolute', top: 52, right: 16, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  videoCloseText: { color: colors.card, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});
