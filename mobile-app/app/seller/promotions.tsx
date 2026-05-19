import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime, money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Product } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

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
  const [productId, setProductId] = useState('');
  const [discount, setDiscount] = useState('');
  const [days, setDays] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refreshing, error, refresh, setData } = useRemote<{ products: Product[]; promos: Promo[] }>(async () => {
    const [products, promos] = await Promise.all([
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}`),
      api.get<Promo[]>('product', `/promotions?sellerId=${encodeURIComponent(user?.id || '')}`),
    ]);
    const normalizedProducts = asArray<Product>(products);
    if (!productId && normalizedProducts[0]?._id) setProductId(normalizedProducts[0]._id);
    return { products: normalizedProducts, promos: asArray<Promo>(promos) };
  }, [user?.id]);

  const create = async () => {
    if (!productId || !discount || !days) return;
    setSubmitting(true);
    try {
      const end = new Date();
      end.setDate(end.getDate() + Number(days));
      const promo = await api.post<Promo>('product', '/promotions', {
        productId,
        type: 'percentage',
        discount: Number(discount),
        endDate: end.toISOString(),
      });
      setData({ products: data?.products || [], promos: [promo, ...(data?.promos || [])] });
      setDiscount('');
      setDays('');
    } catch (err) {
      Alert.alert('Promotion failed', err instanceof Error ? err.message : 'Could not create promotion.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    await api.delete('product', `/promotions/${id}`);
    setData({ products: data?.products || [], promos: (data?.promos || []).filter(promo => promo._id !== id) });
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}>
      <View style={styles.panel}>
        <Text style={styles.title}>Create promotion</Text>
        <View style={styles.productPills}>
          {data?.products.map(product => (
            <TouchableOpacity key={product._id} style={[styles.pill, productId === product._id && styles.pillActive]} onPress={() => setProductId(product._id)}>
              <Text style={[styles.pillText, productId === product._id && styles.pillTextActive]}>{product.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Discount percentage" value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="10" />
        <Field label="Duration in days" value={days} onChangeText={setDays} keyboardType="numeric" placeholder="7" />
        <PrimaryButton label="Create promotion" onPress={create} loading={submitting} disabled={!productId || !discount || !days} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Active and historical deals</Text>
        {data?.promos.length ? data.promos.map(promo => {
          const product = promo.product || (typeof promo.productId === 'object' ? promo.productId : undefined);
          return (
            <View key={promo._id} style={styles.promo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>{product?.name || 'Product promotion'}</Text>
                <Text style={styles.promoMeta}>{promo.discount}% off until {formatDateTime(promo.endDate)}</Text>
                {promo.promotedPrice ? <Text style={styles.promoPrice}>{money(promo.promotedPrice)}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => remove(promo._id)}><Text style={styles.remove}>End</Text></TouchableOpacity>
            </View>
          );
        }) : <EmptyBlock title="No promotions yet" body="Create a promotion from one of your live products." />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14 },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  productPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8 },
  pillActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: colors.orangeDark },
  promo: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  promoTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  promoMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  promoPrice: { color: colors.greenDark, fontSize: 12, fontWeight: '900', marginTop: 4 },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '900' },
});
