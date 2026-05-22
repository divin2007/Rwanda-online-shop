import React from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Trash2 } from 'lucide-react-native';
import { ProductCard } from '../src/components/Cards';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';
import { asArray } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { Product } from '../src/types';
import { useRemote } from '../src/hooks/useRemote';

export default function WishlistScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh, setData } = useRemote<Product[]>(
    () => isAuthenticated ? api.get<Product[]>('user', '/users/wishlist') : Promise.resolve([]),
    [isAuthenticated],
  );

  const removeFromWishlist = async (product: Product) => {
    Alert.alert(
      'Remove from wishlist',
      `Remove "${product.name}" from your saved items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update
            setData(current => (current || []).filter(p => p._id !== product._id));
            try {
              await api.post('user', '/users/wishlist/remove', { productId: product._id });
            } catch (err) {
              // Revert on failure
              refresh();
              Alert.alert('Error', 'Could not remove item. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in for wishlist" body="Saved products are attached to your RMF account." />;
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const products = asArray<Product>(data);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <Heart color={colors.orange} size={20} fill={colors.orange} />
        <Text style={styles.headerTitle}>Saved items</Text>
        <Text style={styles.headerCount}>{products.length} products</Text>
      </View>

      {products.length ? (
        <View style={styles.grid}>
          {products.map(product => (
            <View key={product._id} style={styles.itemWrap}>
              <ProductCard
                product={product}
                compact
                onPress={() => router.push(`/product/${product._id}`)}
              />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeFromWishlist(product)}
                activeOpacity={0.8}
              >
                <Trash2 color={colors.danger} size={13} />
                <Text style={styles.removeTxt}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <EmptyBlock
          title="No saved products"
          body="Tap the heart ❤️ on product pages to save live RMF listings here."
          actionLabel="Browse products"
          onAction={() => router.push('/products' as any)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14 },
  headerTitle: { flex: 1, color: colors.ink, fontSize: 18, fontWeight: '900' },
  headerCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  itemWrap: { width: '31.3%', gap: 6 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fff7f7' },
  removeTxt: { color: colors.danger, fontSize: 11, fontWeight: '900' },
});
