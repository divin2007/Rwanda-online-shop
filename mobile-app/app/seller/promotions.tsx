import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native';
import { TrendingUp, Package, Percent, Clock } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money } from '../../src/lib/format';
import { asArray, normalizeImageUrl } from '../../src/lib/normalize';
import { Product, ProductVariant } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';
import { Image } from 'react-native';

type Promo = {
  _id: string;
  type: string;
  discount: number;
  endDate?: string;
  promotedPrice?: number;
  product?: Product;
  productId?: Product | string;
};

export default function SellerPromotionsScreen() {
  const { user } = useAuth();
  
  // States
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [days, setDays] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refreshing, error, refresh, setData } = useRemote<{ products: Product[]; promos: Promo[] }>(async () => {
    const [products, promos] = await Promise.all([
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}`),
      api.get<Promo[]>('product', `/promotions?sellerId=${encodeURIComponent(user?.id || '')}`),
    ]);
    const normalizedProducts = asArray<Product>(products);
    
    // Auto-select first product if none selected
    if (!selectedProductId && normalizedProducts[0]?._id) {
      setSelectedProductId(normalizedProducts[0]._id);
    }
    return { products: normalizedProducts, promos: asArray<Promo>(promos) };
  }, [user?.id]);

  const activeProduct = data?.products.find(p => p._id === selectedProductId);
  const activeVariants = asArray<ProductVariant>(activeProduct?.variants);

  // Auto-select first variant or clear when product changes
  React.useEffect(() => {
    if (activeVariants.length > 0) {
      setSelectedVariantId(activeVariants[0].id || activeVariants[0].sku || null);
    } else {
      setSelectedVariantId(null);
    }
  }, [selectedProductId, activeVariants.length]);

  const createPromo = async () => {
    if (!selectedProductId || !discount || !days) return;
    setSubmitting(true);
    try {
      const end = new Date();
      end.setDate(end.getDate() + Number(days));
      
      const payload: any = {
        productId: selectedProductId,
        type: 'percentage',
        discount: Number(discount),
        endDate: end.toISOString(),
      };
      
      // Support variant-specific promotion if backend supports it
      if (selectedVariantId) {
        payload.variantId = selectedVariantId;
      }

      const promo = await api.post<Promo>('product', '/promotions', payload);
      setData({ products: data?.products || [], promos: [promo, ...(data?.promos || [])] });
      setDiscount('');
      setDays('');
      Alert.alert('Promotion live!', 'Your new discount has been applied successfully.');
    } catch (err) {
      Alert.alert('Promotion failed', err instanceof Error ? err.message : 'Could not create promotion.');
    } finally {
      setSubmitting(false);
    }
  };

  const removePromo = async (id: string) => {
    await api.delete('product', `/promotions/${id}`);
    setData({ products: data?.products || [], promos: (data?.promos || []).filter(promo => promo._id !== id) });
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#a63f00" />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TrendingUp color="#a63f00" size={32} />
        <Text style={styles.headerTitle}>Promotions & Deals</Text>
        <Text style={styles.headerDesc}>Boost your sales by offering discounts on products or specific variants.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Select Target Item</Text>
        
        {/* Products Selection */}
        <Text style={styles.fieldLabel}>CHOOSE PRODUCT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {data?.products.map(product => {
            const isActive = selectedProductId === product._id;
            return (
              <TouchableOpacity 
                key={product._id} 
                style={[styles.pill, isActive && styles.pillActive]} 
                onPress={() => setSelectedProductId(product._id)}
                activeOpacity={0.8}
              >
                {isActive && <Package color="#ffffff" size={14} style={{ marginRight: 6 }} />}
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{product.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Variants Selection (Only if product has variants) */}
        {activeVariants.length > 0 && (
          <View style={styles.variantsBox}>
            <Text style={styles.fieldLabel}>CHOOSE SPECIFIC VARIANT</Text>
            <View style={styles.variantsGrid}>
              <TouchableOpacity 
                style={[styles.variantCard, selectedVariantId === null && styles.variantCardActive]}
                onPress={() => setSelectedVariantId(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.variantCardTxt, selectedVariantId === null && styles.variantCardTxtActive]}>Entire Product</Text>
              </TouchableOpacity>

              {activeVariants.map(variant => {
                const vId = variant.id || variant.sku;
                const isActive = selectedVariantId === vId;
                return (
                  <TouchableOpacity 
                    key={vId} 
                    style={[styles.variantCard, isActive && styles.variantCardActive]}
                    onPress={() => setSelectedVariantId(vId || null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.variantCardTxt, isActive && styles.variantCardTxtActive]}>{variant.title || variant.sku}</Text>
                    {variant.price ? <Text style={[styles.variantMeta, isActive && { color: 'rgba(255,255,255,0.7)' }]}>+ {variant.price} RWF</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Deal Parameters</Text>
        
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.fieldLabel}>DISCOUNT %</Text>
            <View style={styles.textInputBox}>
              <Percent color="#8e9e95" size={16} />
              <TextInput 
                style={styles.textInput} 
                value={discount} 
                onChangeText={setDiscount} 
                keyboardType="numeric" 
                placeholder="e.g. 15"
                placeholderTextColor="#8e9e95"
              />
            </View>
          </View>
          
          <View style={styles.inputWrap}>
            <Text style={styles.fieldLabel}>DURATION (DAYS)</Text>
            <View style={styles.textInputBox}>
              <Clock color="#8e9e95" size={16} />
              <TextInput 
                style={styles.textInput} 
                value={days} 
                onChangeText={setDays} 
                keyboardType="numeric" 
                placeholder="e.g. 7"
                placeholderTextColor="#8e9e95"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, (!selectedProductId || !discount || !days) && styles.primaryBtnDisabled]}
          onPress={createPromo}
          disabled={!selectedProductId || !discount || !days || submitting}
          activeOpacity={0.9}
        >
          {submitting ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.primaryBtnTxt}>LAUNCH PROMOTION</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>Active Deals Dashboard</Text>
      {data?.promos.length ? (
        <View style={styles.promosList}>
          {data.promos.map(promo => {
            const product = promo.product || (typeof promo.productId === 'object' ? promo.productId : undefined);
            const img = normalizeImageUrl(product?.images?.[0]) || 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500';
            
            return (
              <View key={promo._id} style={styles.promoItemCard}>
                <Image source={{ uri: img }} style={styles.promoImg} />
                <View style={styles.promoMetaBox}>
                  <Text style={styles.promoProductTitle} numberOfLines={1}>{product?.name || 'Product promotion'}</Text>
                  <View style={styles.promoBadgeRow}>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeTxt}>{promo.discount}% OFF</Text>
                    </View>
                    <Text style={styles.promoDateTxt}>Until {formatDateTime(promo.endDate).split(',')[0]}</Text>
                  </View>
                  {promo.promotedPrice && <Text style={styles.promoPriceTxt}>{money(promo.promotedPrice)}</Text>}
                </View>
                
                <TouchableOpacity style={styles.endBtn} onPress={() => removePromo(promo._id)}>
                  <Text style={styles.endBtnTxt}>END</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyBlock title="No active deals" body="You don't have any running promotions right now. Launch one above!" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8f5' },
  content: { padding: 16, paddingBottom: 60, gap: 16 },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1eee9',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1b1c1c' },
  headerDesc: { fontSize: 13, color: '#8e9e95', textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1eee9', borderRadius: 20, padding: 20, gap: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#1b1c1c', marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '900', color: '#a63f00', letterSpacing: 1, textTransform: 'uppercase' },
  pillsScroll: { gap: 8, paddingRight: 20, paddingBottom: 4 },
  pill: { 
    backgroundColor: '#ffffff', 
    borderWidth: 1, 
    borderColor: '#e0e0e0', 
    borderRadius: 100, 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  pillActive: { backgroundColor: '#a63f00', borderColor: '#a63f00' },
  pillText: { fontSize: 13, fontWeight: '800', color: '#1b1c1c' },
  pillTextActive: { color: '#ffffff' },
  variantsBox: {
    backgroundColor: '#faf8f5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  variantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  variantCardActive: { backgroundColor: '#1b1c1c', borderColor: '#1b1c1c' },
  variantCardTxt: { fontSize: 12, fontWeight: '800', color: '#1b1c1c' },
  variantCardTxtActive: { color: '#ffffff' },
  variantMeta: { fontSize: 9, fontWeight: '700', color: '#8e9e95', marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputWrap: { flex: 1, gap: 8 },
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    gap: 8,
  },
  textInput: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#1b1c1c', height: '100%' },
  primaryBtn: { backgroundColor: '#a63f00', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  sectionHeading: { fontSize: 18, fontWeight: '900', color: '#1b1c1c', marginTop: 12 },
  promosList: { gap: 12 },
  promoItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1eee9', borderRadius: 16, padding: 12, gap: 12 },
  promoImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#f1eee9' },
  promoMetaBox: { flex: 1, gap: 4 },
  promoProductTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b1c1c' },
  promoBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountBadge: { backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#ffedd5' },
  discountBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#a63f00' },
  promoDateTxt: { fontSize: 10, fontWeight: '700', color: '#8e9e95' },
  promoPriceTxt: { fontSize: 13, fontWeight: '900', color: '#16a34a' },
  endBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  endBtnTxt: { color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
