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
  ArrowLeft, Check, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingBag, Star, Store,
  MapPin, Lock, Truck, Shield
} from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { money, safeText } from '../../src/lib/format';
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Off-white Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), height: 56 + Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color="#1b1c1c" size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <MapPin color="#a63f00" size={14} style={{ marginRight: 4 }} />
          <Text style={styles.headerLogoTxt}>RMF Kigali</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/cart' as any)} activeOpacity={0.7}>
          <View style={styles.bagWrapper}>
            <ShoppingBag color="#1b1c1c" size={22} />
            {itemCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeTxt}>{itemCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Sneaker Image Showcase with Terracotta Background ── */}
        <View style={styles.imageGalleryContainer}>
          <Image source={{ uri: displayedImage }} style={styles.mainSneakerImage} />
          
          <TouchableOpacity 
            style={styles.floatingWishlist} 
            onPress={() => setWishlisted(!wishlisted)}
            activeOpacity={0.8}
          >
            <Heart 
              color={wishlisted ? '#a63f00' : '#8e9e95'} 
              fill={wishlisted ? '#a63f00' : 'none'} 
              size={18} 
            />
          </TouchableOpacity>

          {/* Underneath image gallery thumbnails grid */}
          {galleryImages.length > 1 && (
            <View style={styles.thumbnailsContainer}>
              {galleryImages.slice(0, 4).map((img, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.thumbCard, activeImageIndex === idx && styles.thumbCardActive]}
                  onPress={() => setActiveImageIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: img }} style={styles.thumbImg} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {galleryImages.length > 0 && (
             <Text style={styles.galleryLabel}>PRODUCT SHOWCASE • Image {activeImageIndex + 1} of {galleryImages.length}</Text>
          )}
        </View>

        {/* ── Details Section ── */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsHeading}>Product Details</Text>
          
          <View style={styles.descriptionWrapper}>
            <View style={styles.verticalHighlightBar} />
            <Text style={styles.descriptionText}>{product.description || 'No description provided.'}</Text>
          </View>

          {/* Specs grid cards (2x2) */}
          <View style={styles.specsGrid}>
            <View style={styles.specItemCard}>
              <Text style={styles.specCardLabel}>CATALOG CATEGORY</Text>
              <Text style={styles.specCardVal}>{product.categoryLabel || product.category || 'General'}</Text>
            </View>

            <View style={styles.specItemCard}>
              <Text style={styles.specCardLabel}>DELIVERY UNIT</Text>
              <Text style={styles.specCardVal}>per {effectiveUnit.toUpperCase()}</Text>
            </View>

            <View style={styles.specItemCard}>
              <Text style={styles.specCardLabel}>FULFILLMENT TYPE</Text>
              <Text style={styles.specCardVal}>{product.stockType === 'on_demand' ? 'On Demand' : 'Finite'}</Text>
            </View>

            <View style={styles.specItemCard}>
              <Text style={styles.specCardLabel}>RATING SUMMARY</Text>
              <Text style={styles.specCardVal}>{avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : 'No ratings'}</Text>
            </View>
          </View>

          {/* Local Origin Card */}
          {product.isMadeInRwanda && (
            <View style={styles.localOriginCard}>
              <View style={styles.localOriginLeft}>
                <Text style={styles.specCardLabel}>LOCAL ORIGIN</Text>
                <Text style={styles.localOriginSub}>Verified Made in Rwanda</Text>
              </View>
              <ShieldCheck color="#22c55e" size={24} />
            </View>
          )}

          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => {
              const marketId = idOf(seller?.marketId) || idOf(product.marketId);
              if (marketId) router.push(`/market/${marketId}` as any);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.sellerIcon}><Store color="#a63f00" size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.specCardLabel}>VERIFIED SELLER</Text>
              <Text style={styles.localOriginSub}>{seller?.shopDetails?.name || seller?.stallName || 'Seller profile pending'}</Text>
            </View>
            <ShieldCheck color="#16a34a" size={18} />
          </TouchableOpacity>

          {/* Verified Customer Feedback */}
          <Text style={[styles.detailsHeading, { marginTop: 24 }]}>Product Reviews</Text>
          {reviewList.length > 0 ? (
            reviewList.map(review => (
              <View key={review._id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Stars rating={review.rating} size={13} />
                  <Text style={styles.reviewerName}>{review.buyer?.fullName || 'Verified buyer'}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))
          ) : (
            <View style={styles.reviewsEmptyCard}>
              <Star color="#8e9e95" size={32} style={styles.emptyStar} />
              <Text style={styles.emptyReviewTxt}>No customer ratings submitted yet for this product.</Text>
            </View>
          )}
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

      {/* ── Fixed Bottom Panel ── */}
      <View style={styles.bottomPanel}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bottomPanelScroll}>
          <Text style={styles.bottomCat}>{(product.categoryLabel || product.category || 'Product').toUpperCase()}</Text>
          <Text style={styles.bottomTitle} numberOfLines={1}>{product.name}</Text>

          {/* Price Container */}
          <View style={styles.bottomPriceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.bottomPriceVal}>{effectivePrice.toLocaleString()}</Text>
              <Text style={styles.bottomPriceCur}>RWF</Text>
              <Text style={styles.bottomPriceUnit}>PER {effectiveUnit.toUpperCase()}</Text>
            </View>
            <Text style={styles.updatedDateTxt}>PRICE UPDATED RECENTLY</Text>
          </View>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <View style={styles.variantsBlock}>
              <Text style={styles.blockLabel}>CHOOSE OPTION / VARIANT</Text>
              <View style={styles.variantsList}>
                {variants.map((v, index) => {
                  const isSelected = selectedVariantIndex === index;
                  const variantImagesList = imagesOfVariant(v);
                  const hasVariantImg = variantImagesList.length > 0;
                  return (
                    <TouchableOpacity
                      key={`variant-${index}`}
                      style={[styles.variantRowCard, isSelected && styles.variantRowCardActive]}
                      onPress={() => setSelectedVariantIndex(index)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.variantLeft}>
                        {hasVariantImg ? (
                          <Image 
                            source={{ uri: variantImagesList[0] }} 
                            style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#f5f5f5' }} 
                          />
                        ) : (
                          <View style={[styles.colorPreviewCircle, { backgroundColor: (v as any).color || '#a63f00' }]} />
                        )}
                        <View style={styles.variantMeta}>
                          <Text style={styles.variantTitleTxt}>{v.title || 'Variant'}</Text>
                          {v.sku && <Text style={styles.variantSkuTxt}>SKU: {v.sku}</Text>}
                        </View>
                      </View>

                      <View style={styles.variantRight}>
                        <Text style={styles.variantPriceTxt}>{(basePrice + (Number(v.price) || 0)).toLocaleString()} RWF</Text>
                        <Text style={styles.variantMarkupTxt}>
                          {!v.price ? '+0 RWF' : `+${Number(v.price).toLocaleString()} RWF`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Status Row */}
          <View style={styles.statusBlock}>
            <View style={styles.statusCol}>
              <Text style={styles.blockLabel}>STATUS</Text>
              <View style={styles.statusIndicator}>
                <View style={[styles.greenDot, !inStock && { backgroundColor: '#ef4444' }]} />
                <Text style={styles.statusValTxt}>{inStock ? 'IN STOCK' : 'OUT OF STOCK'}</Text>
              </View>
            </View>
            <View style={styles.statusColRight}>
              <Text style={styles.blockLabel}>STOCK LEVEL</Text>
              <Text style={styles.stockQtyVal}>{effectiveStockQuantity ?? 'MANAGED'} {effectiveUnit.toUpperCase()} AVAILABLE</Text>
            </View>
          </View>

          {/* Quantity Selector and Badges */}
          <View style={styles.controlsRow}>
            <View style={styles.quantityPicker}>
              <TouchableOpacity 
                style={styles.qtyPickerBtn} 
                onPress={() => setQty(prev => Math.max(1, prev - 1))}
                activeOpacity={0.7}
              >
                <Minus color="#1b1c1c" size={14} />
              </TouchableOpacity>
              <Text style={styles.qtyTextVal}>{qty}</Text>
              <TouchableOpacity 
                style={styles.qtyPickerBtn} 
                onPress={() => setQty(prev => prev + 1)}
                activeOpacity={0.7}
              >
                <Plus color="#1b1c1c" size={14} />
              </TouchableOpacity>
            </View>

            {/* Micro badges */}
            <View style={styles.microBadgesCol}>
              <View style={styles.microBadge}>
                <Lock color="#1b1c1c" size={10} />
                <Text style={styles.microBadgeTxt}>SECURE</Text>
              </View>
              <View style={styles.microBadge}>
                <Truck color="#1b1c1c" size={10} />
                <Text style={styles.microBadgeTxt}>RIDER</Text>
              </View>
              <View style={styles.microBadge}>
                <Shield color="#1b1c1c" size={10} />
                <Text style={styles.microBadgeTxt}>WARRANTY</Text>
              </View>
            </View>
          </View>

          {/* Primary CTA */}
          {isNegotiable ? (
            <TouchableOpacity 
              style={[styles.primaryCta, { backgroundColor: colors.orange }, negotiating && { opacity: 0.7 }]} 
              onPress={handleStartNegotiation}
              disabled={negotiating}
              activeOpacity={0.9}
            >
              {negotiating ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
              ) : (
                <ShoppingBag color="#ffffff" size={16} style={{ marginRight: 8 }} />
              )}
              <Text style={[styles.primaryCtaTxt, { color: '#ffffff' }]}>
                {negotiating ? 'STARTING NEGOTIATION...' : '⚡ START ESCROW NEGOTIATION'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.primaryCta, !inStock && { opacity: 0.5 }]} 
              onPress={handleAddToCart}
              disabled={!inStock}
              activeOpacity={0.9}
            >
              <ShoppingBag color="#ffffff" size={16} style={{ marginRight: 8 }} />
              <Text style={styles.primaryCtaTxt}>ADD PRODUCT TO CART</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  mainSneakerImage: {
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
