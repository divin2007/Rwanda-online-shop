import React, { useMemo, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Heart, Minus, Play, Plus, ShieldCheck, ShoppingBag, Store } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { money, safeText } from '../../src/lib/format';
import { asArray, imageOf, productToCartItem, sellerProfileOf } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { OrderMessage, Product, ProductVariant } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [variantIndex, setVariantIndex] = useState(-1);
  const [wishlisted, setWishlisted] = useState(false);

  const { data: product, loading, error, refresh } = useRemote<Product>(
    () => api.get<Product>('product', `/products/${productId}`, { auth: false }),
    [productId],
  );

  const variants = useMemo(() => asArray<ProductVariant>(product?.variants).filter(item => item.isActive !== false), [product?.variants]);
  const selectedVariant = variantIndex >= 0 ? variants[variantIndex] : undefined;
  const seller = product ? sellerProfileOf(product) : null;
  const image = selectedVariant?.images?.[0] || imageOf(product);
  const price = Number(product?.price || 0) + Number(selectedVariant?.price || 0);
  const stockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const inStock = selectedVariant?.inStock ?? product?.inStock;

  React.useEffect(() => {
    if (!product?._id) return;
    api.post('product', `/products/${product._id}/interactions`, { action: 'product_view' }).catch(() => undefined);
  }, [product?._id]);

  const addToCart = () => {
    if (!product) return;
    try {
      addItem(productToCartItem(product, quantity, variantIndex));
      api.post('product', `/products/${product._id}/interactions`, { action: 'add_to_cart' }).catch(() => undefined);
      router.push('/cart');
    } catch (err) {
      Alert.alert('Cannot add item', err instanceof Error ? err.message : 'This product is not orderable yet.');
    }
  };

  const toggleWishlist = async () => {
    if (!product) return;
    setWishlisted(current => !current);
    try {
      await api.post('user', wishlisted ? '/users/wishlist/remove' : '/users/wishlist', { productId: product._id });
      if (!wishlisted) api.post('product', `/products/${product._id}/interactions`, { action: 'wishlist' }).catch(() => undefined);
    } catch (err) {
      setWishlisted(current => !current);
      Alert.alert('Wishlist unavailable', err instanceof Error ? err.message : 'Please sign in and try again.');
    }
  };

  if (loading && !product) return <LoadingBlock />;
  if (error && !product) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!product) return <EmptyBlock title="Product not found" body="The product service did not return this item." />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imagePanel}>
          {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : (
            <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>{product.name.slice(0, 2).toUpperCase()}</Text></View>
          )}
          <TouchableOpacity style={styles.wishlist} onPress={toggleWishlist} activeOpacity={0.85}>
            <Heart color={wishlisted ? colors.orange : colors.ink} fill={wishlisted ? colors.orange : 'transparent'} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{product.categoryLabel || product.category || 'Product'}</Text></View>
            {product.isMadeInRwanda ? <View style={styles.localBadge}><Text style={styles.localBadgeText}>Made in Rwanda</Text></View> : null}
          </View>
          <Text style={styles.title}>{product.name}</Text>

          <View style={styles.priceCard}>
            <Text style={styles.label}>Live price</Text>
            <Text style={styles.price}>{money(price)}</Text>
            <Text style={styles.priceMeta}>per {selectedVariant?.unit || product.unit || 'unit'}</Text>
          </View>

          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => seller?._id && router.push(`/market/${seller.marketId || product.marketId}`)}
            activeOpacity={0.85}
          >
            <View style={styles.sellerIcon}><Store color={colors.orange} size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Verified seller</Text>
              <Text style={styles.sellerName}>{seller?.shopDetails?.name || seller?.stallName || 'Seller profile pending'}</Text>
            </View>
            <ShieldCheck color={colors.success} size={18} />
          </TouchableOpacity>

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details from seller</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

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

          {variants.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose variant</Text>
              <View style={styles.variants}>
                {variants.map((variant, index) => {
                  const active = variantIndex === index;
                  return (
                    <TouchableOpacity key={variant.sku || variant.id || index} style={[styles.variant, active && styles.variantActive]} onPress={() => setVariantIndex(index)} activeOpacity={0.85}>
                      <View style={[styles.radio, active && styles.radioActive]}>{active ? <Check color={colors.card} size={12} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.variantTitle}>{safeText(variant.title, 'Variant')}</Text>
                        {variant.sku ? <Text style={styles.variantMeta}>{variant.sku}</Text> : null}
                      </View>
                      <Text style={styles.variantPrice}>{money(Number(product.price || 0) + Number(variant.price || 0))}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {selectedVariant?.videoUrl ? (
            <TouchableOpacity style={styles.videoCard} activeOpacity={0.9} onPress={() => Linking.openURL(selectedVariant.videoUrl as string)}>
              {selectedVariant.thumbnailUrl || image ? (
                <Image source={{ uri: selectedVariant.thumbnailUrl || image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              <View style={styles.videoOverlay}>
                <View style={styles.videoPlay}><Play color={colors.card} fill={colors.card} size={18} /></View>
                <Text style={styles.videoTitle}>Watch this variant</Text>
                <Text style={styles.videoMeta}>{selectedVariant.title || product.name}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

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
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.qty}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(value => Math.max(1, value - 1))}><Minus color={colors.ink} size={16} /></TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(value => value + 1)}><Plus color={colors.ink} size={16} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.cartButton, !inStock && styles.cartButtonDisabled]} onPress={addToCart} disabled={!inStock} activeOpacity={0.9}>
          <ShoppingBag color={colors.greenDark} size={18} />
          <Text style={styles.cartButtonText}>Add to cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 120 },
  imagePanel: { height: 310, backgroundColor: colors.orangeSoft },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark },
  imageFallbackText: { color: colors.orange, fontSize: 42, fontWeight: '900' },
  wishlist: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 18, gap: 16 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  localBadge: { backgroundColor: colors.greenSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  localBadgeText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 29, lineHeight: 34, fontWeight: '900' },
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
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14 },
  qty: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center' },
  qtyButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 28, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '900' },
  cartButton: { flex: 1, height: 50, borderRadius: 10, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cartButtonDisabled: { opacity: 0.45 },
  cartButtonText: { color: colors.greenDark, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
});
