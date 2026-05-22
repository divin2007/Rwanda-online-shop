import React, { useMemo, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, Modal,
  Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Check, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingBag, Star, Store,
} from 'lucide-react-native';
import { FastImage } from '../../src/components/FastImage';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { money, safeText } from '../../src/lib/format';
import { asArray, imageOf, productToCartItem, sellerProfileOf, normalizeImageUrl, normalizeMediaUrl, idOf } from '../../src/lib/normalize';
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
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [variantIndex, setVariantIndex] = useState(-1);
  const [wishlisted, setWishlisted] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [variantVideoUrl, setVariantVideoUrl] = useState<string | null>(null);

  const { data: product, loading, error, refresh } = useRemote<Product>(
    () => api.get<Product>('product', `/products/${productId}`, { auth: false }),
    [productId],
  );

  const { data: reviews } = useRemote<Review[]>(
    () => productId ? api.get<Review[]>('product', `/products/${productId}/reviews`).catch(() => []) : Promise.resolve([]),
    [productId],
  );

  const variants = useMemo(() => asArray<ProductVariant>(product?.variants).filter(item => item.isActive !== false), [product?.variants]);
  const selectedVariant = variantIndex >= 0 ? variants[variantIndex] : undefined;
  const seller = product ? sellerProfileOf(product) : null;

  // Build image gallery from all images + variant images
  const allImages = useMemo(() => {
    if (!product) return [];
    const base = (product.images?.length ? product.images : [imageOf(product)]).filter(Boolean) as string[];
    const variantImgs = variants.flatMap(v => v.images || []);
    const merged = [...new Set([...base, ...variantImgs])];
    return merged.map(normalizeImageUrl).filter(Boolean) as string[];
  }, [product, variants]);

  const currentImage = selectedVariant?.images?.[0]
    ? normalizeImageUrl(selectedVariant.images[0])
    : allImages[imageIndex];

  const basePrice = Number(product?.price || 0);
  const addPrice = selectedVariant?.price !== undefined && selectedVariant?.price !== null
    ? Number(selectedVariant.price)
    : 0;
  const price = basePrice + addPrice;
  const stockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const inStock = selectedVariant?.inStock ?? product?.inStock;

  const avgRating = useMemo(() => {
    const r = asArray<Review>(reviews);
    if (!r.length) return 0;
    return r.reduce((sum, rev) => sum + (rev.rating || 0), 0) / r.length;
  }, [reviews]);

  React.useEffect(() => {
    if (!product?._id) return;
    api.post('product', `/products/${product._id}/interactions`, { action: 'product_view' }).catch(() => undefined);
  }, [product?._id]);

  const addToCart = () => {
    if (!product) return;
    if (variants.length > 0 && variantIndex === -1) {
      Alert.alert('Select variant', 'Please choose a product variant before adding to cart.');
      return;
    }
    try {
      addItem(productToCartItem(product, quantity, variantIndex));
      api.post('product', `/products/${product._id}/interactions`, { action: 'add_to_cart' }).catch(() => undefined);
      router.push('/cart');
    } catch (err) {
      Alert.alert('Cannot add item', err instanceof Error ? err.message : 'This product is not orderable yet.');
    }
  };

  const startNegotiation = async () => {
    if (!product) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to negotiate prices with the seller.');
      return;
    }
    if (String(user.role).toUpperCase() !== 'BUYER') {
      Alert.alert('Buyer account required', 'Negotiations must be started from a buyer account. Please switch accounts before requesting a quote.');
      return;
    }
    if (variants.length > 0 && variantIndex === -1) {
      Alert.alert('Select variant', 'Please choose a product variant before starting a negotiation.');
      return;
    }

    try {
      const subtotal = price * quantity;
      const deliveryFee = 1000;
      const platformCommission = Math.max(subtotal * 0.015, 100);
      const gatewayFee = Math.ceil(subtotal * 0.02);
      const totalAmount = subtotal + deliveryFee + gatewayFee;
      const sellerProfile = sellerProfileOf(product);
      const buyerUserId = idOf(user) || user.id || (user as any)._id || (user as any).userId;

      const payload = {
        buyer: {
          userId: buyerUserId,
          fullName: user.fullName || 'Buyer',
          phone: user.phone || 'N/A',
        },
        seller: {
          sellerId: sellerProfile?._id || product.sellerId,
          userId: sellerProfile?.userId || null,
          fullName: sellerProfile?.shopDetails?.name || sellerProfile?.stallName || 'Seller',
          stallId: sellerProfile?.stallId || 'N/A',
          marketId: idOf(product.marketId) || idOf(sellerProfile?.marketId),
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: price,
          quantity,
          unit: selectedVariant?.unit || product.unit || 'unit',
          category: product.categoryLabel || product.category || 'Product',
          categoryId: product.categoryId,
          imageUrl: currentImage || allImages[0],
          images: allImages,
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
        notes: `Negotiation started for ${product.name} on Mobile`,
      };

      const response = await api.post<any>('order', '/orders', payload);
      const order = response.data?.data || response.data || response;
      const orderId = order?._id || order?.id;

      if (!orderId) {
        throw new Error('Failed to parse order ID from response');
      }

      Alert.alert('Negotiation initiated', 'Redirecting to your order dashboard...', [
        { text: 'OK', onPress: () => router.push(`/orders/${orderId}` as any) }
      ]);
    } catch (err) {
      Alert.alert('Negotiation failed', err instanceof Error ? err.message : 'Failed to initiate price negotiation. Please try again.');
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

  const shareProduct = async () => {
    if (!product) return;
    try {
      await Share.share({
        title: product.name,
        message: `Check out "${product.name}" on RMF — ${money(price)}\nhttps://rwshop.org/product/${product._id}`,
      });
    } catch { /* ignore */ }
  };

  if (loading && !product) return <LoadingBlock />;
  if (error && !product) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!product) return <EmptyBlock title="Product not found" body="The product service did not return this item." />;

  const reviewList = asArray<Review>(reviews);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Image gallery ──────────────────────────────────────── */}
        <View style={styles.imagePanel}>
          {currentImage ? (
            <Image source={{ uri: currentImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>{product.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          {/* Floating Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <ArrowLeft color={colors.ink} size={18} />
          </TouchableOpacity>
          {/* Wishlist + Share buttons */}
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageBtn} onPress={shareProduct} activeOpacity={0.85}>
              <Share2 color={colors.ink} size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={toggleWishlist} activeOpacity={0.85}>
              <Heart color={wishlisted ? colors.orange : colors.ink} fill={wishlisted ? colors.orange : 'transparent'} size={18} />
            </TouchableOpacity>
          </View>
          {/* Dot indicators for gallery */}
          {allImages.length > 1 && (
            <View style={styles.dotRow}>
              {allImages.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setImageIndex(i)}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Thumbnail strip for multiple images */}
        {allImages.length > 1 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allImages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.thumbStrip}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => setImageIndex(index)} activeOpacity={0.8}>
                <Image
                  source={{ uri: item }}
                  style={[styles.thumb, index === imageIndex && styles.thumbActive]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
        )}

        <View style={styles.body}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{product.categoryLabel || product.category || 'Product'}</Text></View>
            {product.isMadeInRwanda && <View style={styles.localBadge}><Text style={styles.localBadgeText}>Made in Rwanda</Text></View>}
            {product.isNegotiable && <View style={styles.negotiableBadge}><Text style={styles.negotiableBadgeText}>💬 Price negotiable</Text></View>}
          </View>
          <Text style={styles.title}>{product.name}</Text>

          {/* Rating summary */}
          {avgRating > 0 && (
            <View style={styles.ratingRow}>
              <Stars rating={avgRating} />
              <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({reviewList.length} review{reviewList.length !== 1 ? 's' : ''})</Text>
            </View>
          )}

          {/* Price */}
          <View style={styles.priceCard}>
            <Text style={styles.label}>Live price</Text>
            <Text style={styles.price}>{money(price)}</Text>
            <Text style={styles.priceMeta}>per {selectedVariant?.unit || product.unit || 'unit'}</Text>
          </View>

          {/* Seller card */}
          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => {
              const marketId = idOf(seller?.marketId) || idOf(product.marketId);
              if (marketId) {
                router.push(`/market/${marketId}`);
              }
            }}
            activeOpacity={0.85}
          >
            <View style={styles.sellerIcon}><Store color={colors.orange} size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Verified seller</Text>
              <Text style={styles.sellerName}>{seller?.shopDetails?.name || seller?.stallName || 'Seller profile pending'}</Text>
            </View>
            <ShieldCheck color={colors.success ?? '#16a34a'} size={18} />
          </TouchableOpacity>

          {/* Description */}
          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details from seller</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {/* Attributes */}
          {Object.keys(product.attributes || {}).length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Product characteristics</Text>
              <View style={styles.attributes}>
                {Object.entries(product.attributes || {}).map(([key, value]) => (
                  <View key={key} style={styles.attributeRow}>
                    <Text style={styles.attributeKey}>{key}</Text>
                    <Text style={styles.attributeValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Variants */}
          {variants.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose variant</Text>
              <View style={styles.variants}>
                {variants.map((variant, index) => {
                  const active = variantIndex === index;
                  return (
                    <TouchableOpacity
                      key={variant.sku || variant.id || index}
                      style={[styles.variant, active && styles.variantActive]}
                      onPress={() => setVariantIndex(index)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active ? <Check color={colors.card} size={12} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.variantTitle}>{safeText(variant.title, 'Variant')}</Text>
                        {variant.sku ? <Text style={styles.variantMeta}>{variant.sku}</Text> : null}
                      </View>
                      <Text style={styles.variantPrice}>
                        {money(variant.price !== undefined && variant.price !== null ? Number(variant.price) : Number(product.price || 0))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Video */}
          {selectedVariant?.videoUrl ? (
            <TouchableOpacity style={styles.videoCard} activeOpacity={0.9} onPress={() => setVariantVideoUrl(selectedVariant.videoUrl || null)}>
              {selectedVariant.thumbnailUrl || currentImage ? (
                <Image source={{ uri: normalizeImageUrl(selectedVariant.thumbnailUrl) || currentImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              <View style={styles.videoOverlay}>
                <View style={styles.videoPlay}><Play color={colors.card} fill={colors.card} size={18} /></View>
                <Text style={styles.videoTitle}>Watch this variant</Text>
                <Text style={styles.videoMeta}>{selectedVariant.title || product.name}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Stock */}
          <View style={styles.stockCard}>
            <Text style={styles.sectionTitle}>{inStock ? 'Available now' : 'Currently unavailable'}</Text>
            <Text style={styles.description}>
              {product.stockType === 'on_demand'
                ? 'Prepared after seller confirmation.'
                : stockQuantity !== undefined
                  ? `${stockQuantity} ${selectedVariant?.unit || product.unit || 'unit'} available`
                  : 'Stock quantity is managed by the seller.'}
            </Text>
          </View>

          {/* ── Reviews section (matches web) ──────────────────── */}
          <View style={styles.section}>
            <View style={styles.reviewHeader}>
              <Text style={styles.sectionTitle}>Customer reviews</Text>
              {avgRating > 0 && <Stars rating={avgRating} size={16} />}
            </View>
            {reviewList.length ? reviewList.map(review => (
              <View key={review._id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Stars rating={review.rating} size={13} />
                  <Text style={styles.reviewerName}>{review.buyer?.fullName || 'Verified buyer'}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            )) : (
              <Text style={styles.description}>No reviews yet. Be the first to order this product.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={Boolean(variantVideoUrl)} animationType="fade" onRequestClose={() => setVariantVideoUrl(null)}>
        <View style={styles.videoModal}>
          <WebView
            source={{ html: variantVideoHtml(variantVideoUrl) }}
            style={StyleSheet.absoluteFillObject}
            allowsInlineMediaPlayback
            allowsFullscreenVideo={false}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            originWhitelist={['*']}
            backgroundColor="#000"
          />
          <TouchableOpacity style={styles.videoCloseButton} onPress={() => setVariantVideoUrl(null)} activeOpacity={0.85}>
            <Text style={styles.videoCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Footer action */}
      <View style={styles.footer}>
        <View style={styles.qty}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(v => Math.max(1, v - 1))}>
            <Minus color={colors.ink} size={16} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(v => v + 1)}>
            <Plus color={colors.ink} size={16} />
          </TouchableOpacity>
        </View>
        {product.isNegotiable ? (
          <TouchableOpacity
            style={styles.negotiateButton}
            onPress={startNegotiation}
            activeOpacity={0.9}
          >
            <ShoppingBag color={colors.card} size={18} />
            <Text style={styles.negotiateButtonText}>⚡ Start Negotiation</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.cartButton, !inStock && styles.cartButtonDisabled]}
            onPress={addToCart}
            disabled={!inStock}
            activeOpacity={0.9}
          >
            <ShoppingBag color={colors.greenDark} size={18} />
            <Text style={styles.cartButtonText}>Add to cart</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 120 },
  // Image gallery
  imagePanel: { height: 310, backgroundColor: colors.orangeSoft },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark },
  imageFallbackText: { color: colors.orange, fontSize: 42, fontWeight: '900' },
  imageActions: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 18, right: 18, flexDirection: 'row', gap: 8 },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 18, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  imageBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  dotRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.orange, width: 14 },
  thumbStrip: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.orange },
  // Body
  body: { padding: 18, gap: 16 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  localBadge: { backgroundColor: colors.greenSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  localBadgeText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  negotiableBadge: { backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.orange },
  negotiableBadgeText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 29, lineHeight: 34, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  priceCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9 },
  price: { color: colors.greenDark, fontSize: 28, fontWeight: '900', marginTop: 4 },
  priceMeta: { color: colors.orangeDark, fontSize: 12, fontWeight: '800' },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  sellerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  sellerName: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  attributes: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card },
  attributeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  attributeKey: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  attributeValue: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  variants: { gap: 10 },
  variant: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 12 },
  variantActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  variantTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  variantMeta: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  variantPrice: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  stockCard: { backgroundColor: colors.greenSoft, borderRadius: 12, borderWidth: 1, borderColor: '#fed7aa', padding: 14, gap: 6 },
  videoCard: { height: 210, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.greenDark },
  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 },
  videoPlay: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { color: colors.card, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  videoMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  videoModal: { flex: 1, backgroundColor: '#000' },
  videoCloseButton: { position: 'absolute', top: 52, right: 16, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  videoCloseText: { color: colors.card, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  // Reviews
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewCard: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  reviewComment: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  // Footer
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14 },
  qty: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center' },
  qtyButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 28, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '900' },
  cartButton: { flex: 1, height: 50, borderRadius: 10, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cartButtonDisabled: { opacity: 0.45 },
  cartButtonText: { color: colors.greenDark, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  negotiateButton: { flex: 1, height: 50, borderRadius: 10, backgroundColor: colors.orangeDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  negotiateButtonText: { color: colors.card, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
});
