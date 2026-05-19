import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  const { data, loading, refreshing, error, refresh } = useRemote<Product[]>(
    () => isAuthenticated ? api.get<Product[]>('user', '/users/wishlist') : Promise.resolve([]),
    [isAuthenticated],
  );

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
      {products.length ? (
        <View style={styles.grid}>
          {products.map(product => (
            <ProductCard key={product._id} product={product} compact onPress={() => router.push(`/product/${product._id}`)} />
          ))}
        </View>
      ) : (
        <EmptyBlock title="No saved products" body="Tap the heart on product pages to save live RMF listings." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});

