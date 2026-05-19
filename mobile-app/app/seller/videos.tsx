import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Video } from 'lucide-react-native';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { useRemote } from '../../src/hooks/useRemote';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Product, SellerProfile } from '../../src/types';

export default function SellerVideosScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tags, setTags] = useState('');
  const [isShopAd, setIsShopAd] = useState(false);
  const [productId, setProductId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refresh } = useRemote(async () => {
    const [seller, products] = await Promise.all([
      api.get<SellerProfile | null>('seller', '/sellers/me').catch(() => null),
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}&isActive=true`).catch(() => []),
    ]);
    return { seller, products: asArray<Product>(products) };
  }, [user?.id]);

  const save = async () => {
    if (!title.trim() || !videoUrl.trim()) {
      Alert.alert('Missing video', 'Title and public video URL are required.');
      return;
    }
    if (!isShopAd && !productId) {
      Alert.alert('Choose product', 'Product demos need a linked product. Use shop advert for a general shop video.');
      return;
    }
    setSaving(true);
    try {
      await api.post('product', '/seller-videos', {
        title,
        caption,
        videoUrl,
        thumbnailUrl,
        tags,
        placement: isShopAd ? 'SHOP_AD' : 'PRODUCT_AD',
        productId: isShopAd ? undefined : productId,
      });
      setTitle('');
      setCaption('');
      setVideoUrl('');
      setThumbnailUrl('');
      setTags('');
      setProductId('');
      setIsShopAd(false);
      Alert.alert('Video published', 'Your seller video is now available in market feeds.');
      refresh();
    } catch (err) {
      Alert.alert('Video rejected', err instanceof Error ? err.message : 'Could not publish this seller video.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;
  if (!data?.seller) return <EmptyBlock title="Seller profile required" body="Complete seller onboarding before publishing video ads." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Video color={colors.orange} size={24} />
        <Text style={styles.kicker}>Seller video ads</Text>
        <Text style={styles.title}>Show buyers how the product really looks.</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Shop advert video</Text>
          <Switch value={isShopAd} onValueChange={setIsShopAd} trackColor={{ true: colors.orangeSoft }} thumbColor={isShopAd ? colors.orange : colors.faint} />
        </View>
        {!isShopAd ? (
          <View style={styles.productPicker}>
            {data.products.map(product => (
              <TouchableOpacity key={product._id} style={[styles.productPill, productId === product._id && styles.productPillActive]} onPress={() => setProductId(product._id)}>
                <Text style={[styles.productPillText, productId === product._id && styles.productPillTextActive]} numberOfLines={1}>{product.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Field label="Video title" value={title} onChangeText={setTitle} placeholder="Fresh kitenge arrivals" />
        <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="Short product story" multiline />
        <Field label="Video URL" value={videoUrl} onChangeText={setVideoUrl} placeholder="https://..." />
        <Field label="Thumbnail URL" value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." />
        <Field label="Tags" value={tags} onChangeText={setTags} placeholder="pants, kitenge, made-in-rwanda" />
        <PrimaryButton label="Publish video" onPress={save} loading={saving} />
      </View>

      <SellerVideoFeed sellerId={data.seller._id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 16, paddingBottom: 36 },
  hero: { borderRadius: 16, backgroundColor: colors.greenDark, padding: 18, gap: 8 },
  kicker: { color: colors.orange, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.card, fontSize: 25, lineHeight: 30, fontWeight: '900' },
  panel: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 14, gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  productPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productPill: { maxWidth: '48%', borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8 },
  productPillActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  productPillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  productPillTextActive: { color: colors.orangeDark },
});
