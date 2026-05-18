import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, ShieldCheck, MapPin, ArrowLeft } from 'lucide-react-native';

const BASE_PRODUCT_API = 'http://localhost:3003/api/v1';

const MOCK_STALLS = [
  { id: '1', name: 'Murekatete Stall', location: 'Kigali Market Hub, Stall 4A', rating: 4.9, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500', description: 'Your verified partner for premium shoes, authentic footwear, and locally processed organic products.', verified: true },
  { id: '2', name: 'Kigali Sanctuary', location: 'Kiyovu Hills, Craft Zone', rating: 4.8, image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500', description: 'Curating the absolute finest traditional Rwandan art panels, home decor, and authentic heritage pieces.', verified: true },
  { id: '3', name: 'Kimironko Hub', location: 'Kimironko Road, G-Block', rating: 4.7, image: 'https://images.unsplash.com/photo-1488459718432-01055e67e1f5?w=500', description: 'Fresh, organic, and ethically sourced agricultural products straight from the agricultural hubs of Rwanda.', verified: true }
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
    sellerId: '1',
    sellerName: 'Murekatete Stall',
    images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500']
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
    sellerId: '1',
    sellerName: 'Murekatete Stall',
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
    sellerId: '2',
    sellerName: 'Kigali Sanctuary',
    images: ['https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500']
  }
];

export default function StallDetailScreen() {
  const { stallId } = useLocalSearchParams();
  const router = useRouter();
  const [stall, setStall] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Find matching mock stall
    const foundStall = MOCK_STALLS.find(s => s.id === stallId) || MOCK_STALLS[0];
    setStall(foundStall);

    // Fetch products
    fetch(`${BASE_PRODUCT_API}/products`)
      .then(res => res.json())
      .then(res => {
        if (res?.data && Array.isArray(res.data)) {
          // Filter by seller name or seller id matching stall
          const filtered = res.data.filter((p: any) => 
            p.sellerId === foundStall.id || 
            (p.sellerName && p.sellerName.toLowerCase().includes(foundStall.name.toLowerCase().split(' ')[0]))
          );
          setProducts(filtered.length > 0 ? filtered : MOCK_PRODUCTS.filter(p => p.sellerId === foundStall.id));
        } else {
          setProducts(MOCK_PRODUCTS.filter(p => p.sellerId === foundStall.id));
        }
      })
      .catch(() => {
        setProducts(MOCK_PRODUCTS.filter(p => p.sellerId === foundStall.id));
      })
      .finally(() => setLoading(false));
  }, [stallId]);

  if (loading || !stall) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ff6b00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Custom Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft color="#ffffff" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{stall.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Cinematic Stall Banner ── */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: stall.image }} style={styles.bannerImg} />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerInfo}>
            <View style={styles.ratingRow}>
              <View style={styles.ratingBadge}>
                <Star color="#ff6b00" size={12} fill="#ff6b00" />
                <Text style={styles.ratingTxt}>{stall.rating}</Text>
              </View>
              {stall.verified && (
                <View style={styles.verifiedBadge}>
                  <ShieldCheck color="#22c55e" size={14} />
                  <Text style={styles.verifiedTxt}>Verified Partner</Text>
                </View>
              )}
            </View>
            <Text style={styles.stallNameTitle}>{stall.name}</Text>
            <View style={styles.locationRow}>
              <MapPin color="#ff6b00" size={14} />
              <Text style={styles.locationTxt}>{stall.location}</Text>
            </View>
          </View>
        </View>

        {/* ── About Stall ── */}
        <View style={styles.aboutCard}>
          <Text style={styles.cardTitle}>About Our Stall</Text>
          <Text style={styles.aboutTxt}>{stall.description}</Text>
        </View>

        {/* ── Products List ── */}
        <View style={styles.catalogSection}>
          <Text style={styles.sectionTitle}>Stall Catalog ({products.length})</Text>
          
          {products.length === 0 ? (
            <View style={styles.emptyCatalog}>
              <Text style={styles.emptyCatalogTxt}>No active products listed in this stall.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {products.map(item => (
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
                        <Text style={styles.localBadgeTxt}>🇷🇼 LOCAL</Text>
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
  header: {
    height: 64,
    backgroundColor: '#012d1d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bannerContainer: {
    height: 200,
    position: 'relative',
    backgroundColor: '#012d1d',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 45, 29, 0.45)',
  },
  bannerInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ratingBadge: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingTxt: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedTxt: {
    fontSize: 8,
    fontWeight: '950',
    color: '#16a34a',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  stallNameTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationTxt: {
    fontSize: 11,
    color: '#fcf9f8',
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 8,
  },
  aboutTxt: {
    fontSize: 12,
    color: '#414844',
    lineHeight: 18,
    fontWeight: '550',
  },
  catalogSection: {
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b1c1c',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  emptyCatalog: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCatalogTxt: {
    fontSize: 12,
    color: '#8e9e95',
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
