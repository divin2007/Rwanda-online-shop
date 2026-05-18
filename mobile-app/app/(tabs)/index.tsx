import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Image, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Star } from 'lucide-react-native';

const BASE_PRODUCT_API = 'http://localhost:3003/api/v1';
const BASE_MARKET_API = 'http://localhost:3002/api/v1';

// ── Mock Data Fallbacks ──
const MOCK_MARKETS = [
  { id: '1', name: 'Murekatete Stall', location: 'Kigali Market Hub', rating: 4.9, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500' },
  { id: '2', name: 'Kigali Sanctuary', location: 'Kiyovu Hills', rating: 4.8, image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500' },
  { id: '3', name: 'Kimironko Hub', location: 'Kimironko Road', rating: 4.7, image: 'https://images.unsplash.com/photo-1488459718432-01055e67e1f5?w=500' }
];

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

export default function MarketsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>(MOCK_PRODUCTS);
  const [markets, setMarkets] = useState<any[]>(MOCK_MARKETS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    
    // Fetch Verified Local Markets
    fetch(`${BASE_MARKET_API}/markets`)
      .then(res => res.json())
      .then(res => {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setMarkets(res.data);
        }
      })
      .catch(() => {
        console.warn('Market service offline. Displaying cached verified markets.');
        setMarkets(MOCK_MARKETS);
      });

    // Fetch Products
    fetch(`${BASE_PRODUCT_API}/products`)
      .then(res => res.json())
      .then(res => {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setProducts(res.data);
        }
      })
      .catch(() => {
        console.warn('Product service offline. Displaying cached product catalog.');
        setProducts(MOCK_PRODUCTS);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoryLabel && p.categoryLabel.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Top Cinematic Hero ── */}
      <View style={styles.heroContainer}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroSubtitle}>Rwanda Online Marketplace</Text>
          <Text style={styles.heroTitle}>Kigali Sanctuary</Text>
          
          {/* Custom Sleek Search Bar */}
          <View style={styles.searchBar}>
            <Search color="#414844" size={18} />
            <TextInput
              placeholder="Search products, brands, stalls..."
              placeholderTextColor="#8e9e95"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>
      </View>

      {/* ── Stalls Carousel ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verified Local Stalls</Text>
          <Text style={styles.sectionLink}>View All</Text>
        </View>
        
        <FlatList
          horizontal
          data={markets}
          keyExtractor={item => item._id || item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.stallCard} 
              activeOpacity={0.85}
              onPress={() => router.push(`/market/${item.id}`)}
            >
              <Image source={{ uri: item.image }} style={styles.stallImg} />
              <View style={styles.stallBadge}>
                <Star color="#ff6b00" size={10} fill="#ff6b00" />
                <Text style={styles.stallBadgeTxt}>{item.rating}</Text>
              </View>
              <View style={styles.stallMeta}>
                <Text style={styles.stallName}>{item.name}</Text>
                <Text style={styles.stallLoc}>{item.location}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Product Catalog Grid ── */}
      <View style={[styles.sectionContainer, styles.catalogContainer]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Product Catalog</Text>
          <Text style={styles.catalogCount}>{filteredProducts.length} items</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#ff6b00" style={styles.spinner} />
        ) : (
          <View style={styles.gridContainer}>
            {filteredProducts.map(item => (
              <TouchableOpacity
                key={item._id}
                style={styles.productCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/product/${item._id}`)}
              >
                <View style={styles.productImgWrapper}>
                  <Image source={{ uri: item.images?.[0] }} style={styles.productImg} />
                  {item.isMadeInRwanda && (
                    <View style={styles.localBadge}>
                      <Text style={styles.localBadgeTxt}>🇷🇼 MADE IN RWANDA</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productMeta}>
                  <Text style={styles.productCategory}>{item.categoryLabel || 'General'}</Text>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  
                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>{item.price?.toLocaleString()}</Text>
                    <Text style={styles.currency}>RWF</Text>
                    <Text style={styles.unit}>/ {item.unit || 'pc'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcf9f8',
  },
  heroContainer: {
    height: 240,
    backgroundColor: '#012d1d',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 45, 29, 0.4)',
  },
  heroContent: {
    zIndex: 1,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff6b00',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1b1c1c',
    fontWeight: '600',
  },
  sectionContainer: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ff6b00',
  },
  carouselContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stallCard: {
    width: 220,
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  stallImg: {
    width: '100%',
    height: 110,
  },
  stallBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stallBadgeTxt: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginLeft: 4,
  },
  stallMeta: {
    padding: 12,
  },
  stallName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  stallLoc: {
    fontSize: 10,
    color: '#8e9e95',
    marginTop: 2,
    fontWeight: '600',
  },
  catalogContainer: {
    paddingBottom: 40,
  },
  catalogCount: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8e9e95',
  },
  spinner: {
    marginTop: 40,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  productCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    marginHorizontal: '1.5%',
  },
  productImgWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: '#fcf9f8',
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  localBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#e05300',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  localBadgeTxt: {
    fontSize: 7,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  productMeta: {
    padding: 12,
  },
  productCategory: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ff6b00',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  currency: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff6b00',
    marginLeft: 3,
  },
  unit: {
    fontSize: 8,
    color: '#8e9e95',
    marginLeft: 4,
    fontWeight: 'bold',
  },
});
