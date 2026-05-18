import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCart } from '../_layout';
import { Check, Heart, ShoppingBag, ShieldCheck } from 'lucide-react-native';

const BASE_PRODUCT_API = 'http://localhost:3003/api/v1';

const MOCK_PRODUCTS = [
  {
    _id: '6a0b6bf6df45118d6914fd26',
    name: 'Nike J1 low',
    price: 20000,
    unit: 'pair',
    description: 'Premium custom sneaker with vibrant colorways and verified authentic local craftsmanship.',
    inStock: true,
    stockQuantity: 40,
    stockType: 'finite',
    isMadeInRwanda: false,
    isNegotiable: true,
    categoryLabel: 'Shoes & Footwear',
    sellerId: 'seller_123',
    sellerName: 'murekatete Stall',
    images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500'],
    variants: [
      { id: 'v1', sku: 'NJL-WP', title: 'Purple', price: 5000, inStock: true, stockQuantity: 15, images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500'] },
      { id: 'v2', sku: 'NJL-RB', title: 'Royal Blue', price: 10000, inStock: true, stockQuantity: 15, images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500'] },
      { id: 'v3', sku: 'NJL-CH', title: 'Chicago', price: 15000, inStock: true, stockQuantity: 10, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'] }
    ]
  },
  {
    _id: 'prod_2',
    name: 'Rwanda Organic Coffee',
    price: 8500,
    unit: 'bag',
    description: 'Single-origin Bourbon Arabica, light roast with honey and fruit notes.',
    inStock: true,
    stockQuantity: 120,
    stockType: 'finite',
    isMadeInRwanda: true,
    isNegotiable: false,
    categoryLabel: 'Groceries & Foods',
    sellerId: 'seller_123',
    sellerName: 'murekatete Stall',
    images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500']
  },
  {
    _id: 'prod_3',
    name: 'Imigongo Art Panel',
    price: 45000,
    unit: 'piece',
    description: 'Traditional Rwandan geometric artwork crafted using organic materials.',
    inStock: true,
    stockQuantity: 5,
    stockType: 'on_demand',
    isMadeInRwanda: true,
    isNegotiable: true,
    categoryLabel: 'Art & Collectibles',
    sellerId: 'seller_456',
    sellerName: 'Kigali Craft Sanctuary',
    images: ['https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500']
  }
];

const screenWidth = Dimensions.get('window').width;

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_PRODUCT_API}/products/${productId}`)
      .then(res => res.json())
      .then(res => {
        if (res?.data) {
          setProduct(res.data);
        } else {
          const match = MOCK_PRODUCTS.find(p => p._id === productId);
          setProduct(match || MOCK_PRODUCTS[0]);
        }
      })
      .catch(() => {
        const match = MOCK_PRODUCTS.find(p => p._id === productId);
        setProduct(match || MOCK_PRODUCTS[0]);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ff6b00" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
      </View>
    );
  }

  const variants = Array.isArray(product.variants)
    ? product.variants.filter((v: any) => v.isActive !== false)
    : [];

  const selectedVariant = variants[selectedVariantIndex] || null;
  const effectivePrice = (product.price || 0) + (selectedVariant?.price || 0);
  const effectiveUnit = selectedVariant?.unit || product.unit || 'piece';
  const effectiveStockType = selectedVariant?.stockType || product.stockType || 'finite';
  const effectiveStockQuantity = selectedVariant?.stockQuantity ?? product.stockQuantity;

  const rawImages = selectedVariant?.images?.length ? selectedVariant.images : (product.images || []);
  const displayedImage = rawImages[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500';

  const handleAddToCart = () => {
    const item = {
      id: product._id,
      name: product.name,
      price: effectivePrice,
      quantity: qty,
      unit: effectiveUnit,
      category: product.categoryLabel || 'General',
      image: displayedImage,
      variantId: selectedVariant?.id || selectedVariant?.sku || undefined,
      variantTitle: selectedVariant?.title || undefined,
      sellerSku: selectedVariant?.sku || undefined,
      sellerId: product.sellerId || 'seller_123',
      sellerName: product.sellerName || 'Murekatete Stall',
      stallId: 'stall_123',
      marketId: 'market_123'
    };

    addToCart(item);
    router.push('/cart');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Image Gallery ── */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: displayedImage }} style={styles.mainImage} />
          
          {/* Wishlist Button */}
          <TouchableOpacity
            style={[styles.floatingCircle, styles.wishlistBtn]}
            onPress={() => setWishlisted(!wishlisted)}
            activeOpacity={0.8}
          >
            <Heart color={wishlisted ? '#ff6b00' : '#414844'} fill={wishlisted ? '#ff6b00' : 'none'} size={20} />
          </TouchableOpacity>
        </View>

        {/* ── Product Specifications ── */}
        <View style={styles.specContainer}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryTxt}>{product.categoryLabel || 'General'}</Text>
            </View>
            {product.isMadeInRwanda && (
              <View style={styles.localSpecBadge}>
                <Text style={styles.localSpecBadgeTxt}>🇷🇼 locally crafted</Text>
              </View>
            )}
          </View>

          <Text style={styles.productTitle}>{product.name}</Text>

          {/* Pricing Box */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Product Price</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceVal}>{effectivePrice?.toLocaleString()}</Text>
              <Text style={styles.currencyVal}>RWF</Text>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeTxt}>per {effectiveUnit}</Text>
              </View>
            </View>
          </View>

          {/* Stalls Trust Badge */}
          <View style={styles.stallBox}>
            <View style={styles.stallLogo}>
              <Text style={styles.stallLogoTxt}>S</Text>
            </View>
            <View style={styles.stallMeta}>
              <Text style={styles.stallTitle}>Verified Local Partner</Text>
              <Text style={styles.stallSubtitle}>{product.sellerName || 'murekatete Stall'}</Text>
            </View>
            <View style={styles.stallComplianceBadge}>
              <ShieldCheck color="#22c55e" size={16} />
              <Text style={styles.complianceTxt}>Verifiable Partner</Text>
            </View>
          </View>

          {/* Story & Description */}
          <View style={styles.descBox}>
            <Text style={styles.descTitle}>Description</Text>
            <Text style={styles.descTxt}>{product.description}</Text>
          </View>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <View style={styles.variantSection}>
              <View style={styles.variantHeader}>
                <Text style={styles.variantLabel}>Choose Option / Variant</Text>
                <View style={styles.variantCountBadge}>
                  <Text style={styles.variantCountTxt}>{variants.length} Choices</Text>
                </View>
              </View>

              <View style={styles.variantList}>
                {variants.map((v: any, index: number) => {
                  const isSelected = selectedVariantIndex === index;
                  return (
                    <TouchableOpacity
                      key={v.id || v.sku || index}
                      style={[styles.variantCard, isSelected && styles.variantCardActive]}
                      onPress={() => setSelectedVariantIndex(index)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.variantMain}>
                        <View style={[styles.variantCircle, isSelected && styles.variantCircleActive]}>
                          {isSelected && <Check color="#ffffff" size={12} />}
                        </View>
                        <View style={styles.variantInfo}>
                          <Text style={[styles.variantTitle, isSelected && styles.variantTitleActive]}>{v.title}</Text>
                          {v.sku && <Text style={styles.variantSku}>SKU: {v.sku}</Text>}
                        </View>
                      </View>

                      <View style={styles.variantPricing}>
                        <Text style={styles.variantPriceTotal}>
                          {((product.price || 0) + (v.price || 0))?.toLocaleString()} RWF
                        </Text>
                        {v.price !== 0 && (
                          <View style={styles.variantMarkupBadge}>
                            <Text style={styles.variantMarkupTxt}>
                              {v.price > 0 ? `+${v.price?.toLocaleString()} RWF` : `${v.price?.toLocaleString()} RWF`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Stock Status */}
          <View style={styles.statusBox}>
            <View style={styles.statusCol}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusIndicatorRow}>
                <View style={[styles.statusDot, { backgroundColor: product.inStock ? '#22c55e' : '#ef4444' }]} />
                <Text style={styles.statusValue}>{product.inStock ? 'in stock' : 'sold out'}</Text>
              </View>
            </View>

            <View style={styles.statusColRight}>
              <Text style={styles.statusLabel}>Stock Level</Text>
              <Text style={styles.stockLevelTxt}>
                {effectiveStockType === 'on_demand'
                  ? 'Custom Crafted'
                  : `${effectiveStockQuantity || 'Multiple'} ${effectiveUnit} available`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Footer Purchase bar ── */}
      <View style={styles.footer}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty(prev => Math.max(1, prev - 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.qtyBtnTxt}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyTxt}>{qty}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty(prev => prev + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.qtyBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.buyBtn}
          onPress={handleAddToCart}
          activeOpacity={0.9}
        >
          <ShoppingBag color="#012d1d" size={18} style={styles.buyIcon} />
          <Text style={styles.buyBtnTxt}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcf9f8',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fcf9f8',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageContainer: {
    width: screenWidth,
    height: screenWidth * 0.75,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  floatingCircle: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  wishlistBtn: {
    top: 20,
    right: 20,
  },
  specContainer: {
    padding: 24,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#ff6b00',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  localSpecBadge: {
    backgroundColor: '#e05300',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  localSpecBadgeTxt: {
    fontSize: 9,
    fontWeight: '950',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1b1c1c',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  priceContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceVal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  currencyVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ff6b00',
    marginLeft: 4,
  },
  unitBadge: {
    backgroundColor: '#fcf9f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 12,
  },
  unitBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stallBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    borderRadius: 12, // Reduced rounded corners from 24 to 12
    marginBottom: 20,
  },
  stallLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#012d1d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallLogoTxt: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ff6b00',
  },
  stallMeta: {
    flex: 1,
    marginLeft: 12,
  },
  stallTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stallSubtitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginTop: 2,
  },
  stallComplianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  complianceTxt: {
    fontSize: 8,
    fontWeight: '950',
    color: '#16a34a',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  descBox: {
    marginBottom: 24,
  },
  descTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 8,
  },
  descTxt: {
    fontSize: 13,
    color: '#414844',
    lineHeight: 20,
    fontWeight: '550',
  },
  variantSection: {
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  variantLabel: {
    fontSize: 11,
    fontWeight: '950',
    color: '#414844',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  variantCountBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variantCountTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff6b00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variantList: {
    gap: 12,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    borderRadius: 16,
  },
  variantCardActive: {
    borderColor: '#ff6b00',
    backgroundColor: '#fff7ed',
  },
  variantMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  variantCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  variantCircleActive: {
    borderColor: '#ff6b00',
    backgroundColor: '#ff6b00',
  },
  variantInfo: {
    marginLeft: 12,
  },
  variantTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  variantTitleActive: {
    color: '#ff6b00',
  },
  variantSku: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variantPricing: {
    alignItems: 'flex-end',
  },
  variantPriceTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  variantMarkupBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  variantMarkupTxt: {
    fontSize: 8,
    fontWeight: '950',
    color: '#ff6b00',
  },
  statusBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statusCol: {
    flex: 1,
  },
  statusColRight: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1b1c1c',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
  },
  stockLevelTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 88,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fcf9f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnTxt: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  qtyTxt: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1b1c1c',
    paddingHorizontal: 16,
  },
  buyBtn: {
    flex: 1,
    marginLeft: 20,
    backgroundColor: '#ff6b00',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buyIcon: {
    marginRight: 8,
  },
  buyBtnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#012d1d',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
