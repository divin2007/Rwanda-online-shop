import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ArrowLeft, ShoppingBag, Menu, ShieldCheck, Clock, MapPin, 
  Store, Box, Star, Truck, Filter, ChevronDown, ShieldAlert,
  Search, Heart
} from 'lucide-react-native';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/lib/api';
import { productToCartItem } from '../../src/lib/normalize';

export default function StallDetailScreen() {
  const { stallId } = useLocalSearchParams();
  const router = useRouter();
  const { addItem, items } = useCart();
  const [activeTab, setActiveTab] = useState('SHOP PRODUCTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL PRODUCTS');

  useEffect(() => {
    const loadStallData = async () => {
      if (!stallId) return;
      setLoading(true);
      try {
        const sellersData = await api.get<any[]>('seller', '/sellers', { auth: false });
        if (Array.isArray(sellersData)) {
          const matched = sellersData.find(s => s._id === stallId || s.userId === stallId);
          if (matched) {
            setSeller(matched);
            const prods = await api.get<any[]>('product', `/products?sellerId=${matched.userId || matched._id}`, { auth: false });
            if (Array.isArray(prods)) {
              setProducts(prods);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load stall details dynamically:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStallData();
  }, [stallId]);

  const toggleWishlist = (id: string) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddToCart = (product: any) => {
    try {
      addItem(productToCartItem(product, 1));
      router.push('/cart');
    } catch (err) {
      console.warn('Cannot add item to cart:', err instanceof Error ? err.message : err);
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Compute dynamic categories
  const categoriesList = ['ALL PRODUCTS', ...Array.from(new Set(products.map(p => (p.categoryLabel || p.category || 'GENERAL').toUpperCase())))];

  // Filter products dynamically
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMinPrice = minPrice ? product.price >= parseFloat(minPrice) : true;
    const matchesMaxPrice = maxPrice ? product.price <= parseFloat(maxPrice) : true;
    const matchesCategory = selectedCategory === 'ALL PRODUCTS' || (product.categoryLabel || product.category || 'GENERAL').toUpperCase() === selectedCategory;
    return matchesSearch && matchesMinPrice && matchesMaxPrice && matchesCategory;
  });

  // Top 2 favorites
  const favorites = filteredProducts.slice(0, 2);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf8f5' }}>
        <ActivityIndicator size="large" color="#a63f00" />
        <Text style={{ marginTop: 12, color: '#8e9e95', fontWeight: 'bold' }}>Loading stall store...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Off-white Custom Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color="#1b1c1c" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerLogoTxt}>RMF</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/cart')} activeOpacity={0.7}>
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
        {/* ── Cinematic Silk/Metallic Stall Banner ── */}
        <View style={styles.bannerContainer}>
          {/* A dark wave gradient overlay representing the premium screenshot background */}
          <View style={styles.bannerBackgroundOverlay} />
          
          <View style={styles.bannerContent}>
            {/* Top row badges */}
            <View style={styles.badgesRow}>
              <View style={styles.verifiedBadge}>
                <ShieldCheck color="#ffffff" size={12} style={styles.badgeIcon} />
                <Text style={styles.verifiedTxt}>VERIFIED MARKET</Text>
              </View>
              
              <View style={styles.closedBadge}>
                <Clock color="#ffffff" size={12} style={styles.badgeIcon} />
                <Text style={styles.closedTxt}>OPEN NOW</Text>
              </View>
            </View>

            <View style={styles.locationBadge}>
              <MapPin color="#ffffff" size={12} style={styles.badgeIcon} />
              <Text style={styles.locationTxt}>{String(seller?.marketId?.name || 'KIGALI, NYARUGENGE').toUpperCase()}</Text>
            </View>

            {/* Stall Title */}
            <Text style={styles.stallTitle}>{seller?.stallName || 'Stall Store'}</Text>
            <Text style={styles.stallSub}>{seller?.shopDetails?.description || 'Verified physical market vendor on RMF Marketplace'}</Text>

            {/* Statistics Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Store color="#a63f00" size={18} />
                <Text style={styles.statVal}>1</Text>
                <Text style={styles.statLabel}>SELLERS</Text>
              </View>

              <View style={styles.statCard}>
                <Box color="#a63f00" size={18} />
                <Text style={styles.statVal}>{products.length}</Text>
                <Text style={styles.statLabel}>PRODUCTS</Text>
              </View>

              <View style={styles.statCard}>
                <Star color="#a63f00" size={18} />
                <Text style={styles.statVal}>{seller?.rating ? seller.rating.toFixed(1) : '4.8'}</Text>
                <Text style={styles.statLabel}>RATING</Text>
              </View>

              <View style={styles.statCard}>
                <Truck color="#a63f00" size={18} />
                <Text style={styles.statVal}>Live</Text>
                <Text style={styles.statLabel}>DELIVERY</Text>
              </View>
            </View>

            {/* View Delivery Map CTA */}
            <TouchableOpacity style={styles.mapCta} activeOpacity={0.8}>
              <Text style={styles.mapCtaTxt}>VIEW DELIVERY NETWORK MAP</Text>
              <ArrowLeft color="#ffffff" size={14} style={styles.ctaArrow} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabbed View Switches ── */}
        <View style={styles.tabsRow}>
          {['SHOP PRODUCTS', 'ABOUT THE MARKET', 'REVIEWS'].map(tab => {
            const isTabActive = activeTab === tab;
            const labelStr = tab === 'SHOP PRODUCTS' ? 'SHOP PRODUCTS  1' : tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabItem, isTabActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabTxt, isTabActive && styles.tabTxtActive]}>{labelStr}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Filters Section ── */}
        <View style={styles.filterSectionCard}>
          <View style={styles.filterHeader}>
            <Filter color="#a63f00" size={16} />
            <Text style={styles.filterTitle}>FILTERS</Text>
          </View>

          <Text style={styles.fieldLabel}>Search products</Text>
          <View style={styles.searchBox}>
            <Search color="#8e9e95" size={16} />
            <TextInput
              placeholder="Find an item..."
              placeholderTextColor="#8e9e95"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <Text style={styles.fieldLabel}>Price range</Text>
          <View style={styles.priceInputsRow}>
            <TextInput
              placeholder="Min"
              placeholderTextColor="#8e9e95"
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <TextInput
              placeholder="Max"
              placeholderTextColor="#8e9e95"
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              style={styles.priceInput}
            />
          </View>
        </View>

        {/* ── Categories Pills Row ── */}
        <View style={styles.categoriesBlock}>
          <Text style={styles.blockLabel}>CATEGORIES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
            {categoriesList.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={isActive ? styles.catPillActive : styles.catPillInactive}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={isActive ? styles.catPillActiveTxt : styles.catPillInactiveTxt}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Product Specifications Droplist Accordion ── */}
        <View style={styles.accordionCard}>
          <Text style={styles.blockLabel}>PRODUCT DETAILS</Text>
          
          {['DIETARY TYPE', 'BRAND', 'CONDITION'].map(field => (
            <View key={field} style={styles.accordionWrapper}>
              <Text style={styles.accordionLabel}>{field}</Text>
              <TouchableOpacity style={styles.accordionDropdown} activeOpacity={0.8}>
                <Text style={styles.accordionVal}>Any</Text>
                <ChevronDown color="#8e9e95" size={16} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Peach Buyer Protection Alert ── */}
        <View style={styles.buyerProtectionCard}>
          <ShieldAlert color="#c2410c" size={20} style={styles.shieldIconAlert} />
          <View style={styles.protectionInfo}>
            <Text style={styles.protectionTitle}>Buyer protection</Text>
            <Text style={styles.protectionDesc}>
              Payments stay traceable, and support can review delivery or quality issues.
            </Text>
          </View>
        </View>

        {/* ── Customer Favorites (Most Bought Today) ── */}
        {favorites.length > 0 && (
          <View style={styles.favoritesSection}>
            <Text style={styles.favSectionLabel}>CUSTOMER FAVORITES</Text>
            <View style={styles.favHeaderRow}>
              <Text style={styles.favTitle}>Most bought today</Text>
              <ArrowLeft color="#1b1c1c" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
            </View>

            {favorites.map(product => {
              const isWish = wishlist.includes(product._id);
              const imgUrl = product.images?.[0] || 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500';
              return (
                <View key={product._id} style={styles.favoriteProductCard}>
                  <TouchableOpacity 
                    style={styles.favImgWrapper} 
                    activeOpacity={0.9}
                    onPress={() => router.push(`/product/${product._id}`)}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.favProductImg} />
                    
                    {/* Top-left VERIFIED stamp */}
                    <View style={styles.verifiedBadgeBadge}>
                      <ShieldCheck color="#a63f00" size={10} />
                      <Text style={styles.verifiedBadgeTxt}>VERIFIED</Text>
                    </View>

                    {/* Wishlist */}
                    <TouchableOpacity 
                      style={styles.favWishBtn} 
                      onPress={() => toggleWishlist(product._id)}
                      activeOpacity={0.7}
                    >
                      <Heart color={isWish ? '#a63f00' : '#8e9e95'} fill={isWish ? '#a63f00' : 'none'} size={16} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <View style={styles.favInfo}>
                    <Text style={styles.favCat}>{(product.categoryLabel || product.category || 'Shoes').toUpperCase()}</Text>
                    <Text style={styles.favName}>{product.name}</Text>
                    
                    <View style={styles.favPriceRow}>
                      <Text style={styles.favPriceVal}>{product.price?.toLocaleString()} RWF</Text>
                      <Text style={styles.favPriceUnit}>PER {(product.unit || 'pair').toUpperCase()}</Text>
                    </View>

                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillTxt}>AVAILABLE</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.favAddToCartBtn} 
                      onPress={() => handleAddToCart(product)}
                      activeOpacity={0.8}
                    >
                      <ShoppingBag color="#ffffff" size={14} style={{ marginRight: 6 }} />
                      <Text style={styles.favAddToCartTxt}>ADD TO CART</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Stall Products Grid ── */}
        <View style={styles.allProductsSection}>
          <Text style={styles.favSectionLabel}>{String(seller?.stallName || 'Stall').toUpperCase()}</Text>
          <View style={styles.favHeaderRow}>
            <Text style={styles.favTitle}>All products</Text>
            <Text style={styles.itemsCountLabel}>{filteredProducts.length} items</Text>
          </View>

          {filteredProducts.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ebdcd0' }}>
              <Box color="#8e9e95" size={32} />
              <Text style={{ marginTop: 12, fontWeight: 'bold', color: '#1b1c1c' }}>No matching products</Text>
              <Text style={{ marginTop: 4, fontSize: 11, color: '#8e9e95', textAlign: 'center' }}>Try modifying your filter settings or search query.</Text>
            </View>
          ) : (
            filteredProducts.map(product => {
              const isWish = wishlist.includes(product._id);
              const imgUrl = product.images?.[0] || 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500';
              return (
                <View key={product._id} style={styles.favoriteProductCard}>
                  <TouchableOpacity 
                    style={styles.favImgWrapper} 
                    activeOpacity={0.9}
                    onPress={() => router.push(`/product/${product._id}`)}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.favProductImg} />
                    <View style={styles.verifiedBadgeBadge}>
                      <ShieldCheck color="#a63f00" size={10} />
                      <Text style={styles.verifiedBadgeTxt}>VERIFIED</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.favWishBtn} 
                      onPress={() => toggleWishlist(product._id)}
                      activeOpacity={0.7}
                    >
                      <Heart color={isWish ? '#a63f00' : '#8e9e95'} fill={isWish ? '#a63f00' : 'none'} size={16} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <View style={styles.favInfo}>
                    <Text style={styles.favCat}>{(product.categoryLabel || product.category || 'Shoes').toUpperCase()}</Text>
                    <Text style={styles.favName}>{product.name}</Text>
                    
                    <View style={styles.favPriceRow}>
                      <Text style={styles.favPriceVal}>{product.price?.toLocaleString()} RWF</Text>
                      <Text style={styles.favPriceUnit}>PER {(product.unit || 'pair').toUpperCase()}</Text>
                    </View>

                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillTxt}>AVAILABLE</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.favAddToCartBtn} 
                      onPress={() => handleAddToCart(product)}
                      activeOpacity={0.8}
                    >
                      <ShoppingBag color="#ffffff" size={14} style={{ marginRight: 6 }} />
                      <Text style={styles.favAddToCartTxt}>ADD TO CART</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerLogoTxt: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#a63f00',
    letterSpacing: 1.5,
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
    paddingBottom: 40,
  },
  bannerContainer: {
    margin: 16,
    borderRadius: 24,
    backgroundColor: '#171717',
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  bannerBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    opacity: 0.85,
  },
  bannerContent: {
    zIndex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeIcon: {
    marginRight: 4,
  },
  verifiedTxt: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c2d12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  closedTxt: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffedd5',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationTxt: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stallTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  stallSub: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 4,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  statVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#737373',
    letterSpacing: 1,
  },
  mapCta: {
    backgroundColor: '#a63f00',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#a63f00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  mapCtaTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  ctaArrow: {
    transform: [{ rotate: '180deg' }],
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#a63f00',
  },
  tabTxt: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  tabTxtActive: {
    color: '#a63f00',
  },
  filterSectionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1b1c1c',
    letterSpacing: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#1b1c1c',
  },
  priceInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#1b1c1c',
  },
  categoriesBlock: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  blockLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    letterSpacing: 1,
    marginBottom: 12,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catPillActive: {
    backgroundColor: '#a63f00',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catPillActiveTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  catPillInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catPillInactiveTxt: {
    color: '#1b1c1c',
    fontSize: 10,
    fontWeight: 'bold',
  },
  accordionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
  },
  accordionWrapper: {
    gap: 6,
  },
  accordionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    letterSpacing: 0.5,
  },
  accordionDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  accordionVal: {
    fontSize: 13,
    color: '#1b1c1c',
  },
  buyerProtectionCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  shieldIconAlert: {
    marginTop: 2,
  },
  protectionInfo: {
    flex: 1,
    gap: 4,
  },
  protectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#c2410c',
  },
  protectionDesc: {
    fontSize: 10,
    color: '#7c2d12',
    lineHeight: 14,
    fontWeight: '500',
  },
  favoritesSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  favSectionLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 1,
    marginBottom: 6,
  },
  favHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  favTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  favoriteProductCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1eee9',
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 12,
    gap: 16,
    marginBottom: 16,
  },
  favImgWrapper: {
    width: 120,
    height: 120,
    backgroundColor: '#faf8f5',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  favProductImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  verifiedBadgeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#faf8f5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  verifiedBadgeTxt: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#a63f00',
  },
  favWishBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  favCat: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
  },
  favName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  favPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  favPriceVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  favPriceUnit: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
  },
  statusPill: {
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusPillTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#16a34a',
  },
  favAddToCartBtn: {
    backgroundColor: '#a63f00',
    borderRadius: 10,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  favAddToCartTxt: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  allProductsSection: {
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  itemsCountLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
});
