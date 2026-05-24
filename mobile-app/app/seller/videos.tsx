import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native';
import { Video, Package, Link, Image as ImageIcon, Tag } from 'lucide-react-native';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { useRemote } from '../../src/hooks/useRemote';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { Product, ProductVariant, SellerProfile } from '../../src/types';

export default function SellerVideosScreen() {
  const { user } = useAuth();
  
  // States
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tags, setTags] = useState('');
  const [isShopAd, setIsShopAd] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refresh } = useRemote(async () => {
    const [seller, products] = await Promise.all([
      api.get<SellerProfile | null>('seller', '/sellers/me').catch(() => null),
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}&isActive=true`).catch(() => []),
    ]);
    return { seller, products: asArray<Product>(products) };
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

  const save = async () => {
    if (!title.trim() || !videoUrl.trim()) {
      Alert.alert('Missing video', 'Title and public video URL are required.');
      return;
    }
    if (!isShopAd && !selectedProductId) {
      Alert.alert('Choose product', 'Product demos need a linked product. Use shop advert for a general shop video.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title,
        caption,
        videoUrl,
        thumbnailUrl,
        tags,
        placement: isShopAd ? 'SHOP_AD' : 'PRODUCT_AD',
      };

      if (!isShopAd) {
        payload.productId = selectedProductId;
        if (selectedVariantId) {
          payload.variantId = selectedVariantId;
        }
      }

      await api.post('product', '/seller-videos', payload);
      
      setTitle('');
      setCaption('');
      setVideoUrl('');
      setThumbnailUrl('');
      setTags('');
      setSelectedProductId('');
      setSelectedVariantId(null);
      setIsShopAd(false);
      
      Alert.alert('Video published', 'Your seller video is now live on the platform.');
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
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Video color="#a63f00" size={32} />
        <Text style={styles.headerTitle}>Seller Video Ads</Text>
        <Text style={styles.headerDesc}>Publish captivating video content to showcase your shop or specific product variants.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Target & Placement</Text>
        
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>General Shop Advert</Text>
            <Text style={styles.switchDesc}>Video promotes your entire store.</Text>
          </View>
          <Switch 
            value={isShopAd} 
            onValueChange={setIsShopAd} 
            trackColor={{ true: '#fff7ed', false: '#e0e0e0' }} 
            thumbColor={isShopAd ? '#a63f00' : '#ffffff'} 
          />
        </View>

        {!isShopAd && (
          <View style={styles.targetSection}>
            <Text style={styles.fieldLabel}>CHOOSE PRODUCT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
              {data.products.map(product => {
                const isActive = selectedProductId === product._id;
                return (
                  <TouchableOpacity 
                    key={product._id} 
                    style={[styles.pill, isActive && styles.pillActive]} 
                    onPress={() => setSelectedProductId(product._id)}
                    activeOpacity={0.8}
                  >
                    {isActive && <Package color="#ffffff" size={14} style={{ marginRight: 6 }} />}
                    <Text style={[styles.pillText, isActive && styles.pillTextActive]} numberOfLines={1}>{product.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Variants Selection */}
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Video Content</Text>
        
        <View style={styles.inputWrap}>
          <Text style={styles.fieldLabel}>VIDEO TITLE</Text>
          <View style={styles.textInputBox}>
            <TextInput 
              style={styles.textInput} 
              value={title} 
              onChangeText={setTitle} 
              placeholder="e.g. Fresh kitenge arrivals"
              placeholderTextColor="#8e9e95"
            />
          </View>
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.fieldLabel}>CAPTION / STORY</Text>
          <View style={[styles.textInputBox, { height: 80, alignItems: 'flex-start', paddingVertical: 12 }]}>
            <TextInput 
              style={[styles.textInput, { textAlignVertical: 'top' }]} 
              value={caption} 
              onChangeText={setCaption} 
              placeholder="Write a short description..."
              placeholderTextColor="#8e9e95"
              multiline
            />
          </View>
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.fieldLabel}>VIDEO SOURCE URL</Text>
          <View style={styles.textInputBox}>
            <Link color="#8e9e95" size={16} />
            <TextInput 
              style={styles.textInput} 
              value={videoUrl} 
              onChangeText={setVideoUrl} 
              placeholder="https://... (.mp4)"
              placeholderTextColor="#8e9e95"
            />
          </View>
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.fieldLabel}>THUMBNAIL URL (OPTIONAL)</Text>
          <View style={styles.textInputBox}>
            <ImageIcon color="#8e9e95" size={16} />
            <TextInput 
              style={styles.textInput} 
              value={thumbnailUrl} 
              onChangeText={setThumbnailUrl} 
              placeholder="https://... (.jpg)"
              placeholderTextColor="#8e9e95"
            />
          </View>
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.fieldLabel}>SEARCH TAGS</Text>
          <View style={styles.textInputBox}>
            <Tag color="#8e9e95" size={16} />
            <TextInput 
              style={styles.textInput} 
              value={tags} 
              onChangeText={setTags} 
              placeholder="e.g. shoes, fashion, summer"
              placeholderTextColor="#8e9e95"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, (!title || !videoUrl || (!isShopAd && !selectedProductId)) && styles.primaryBtnDisabled]}
          onPress={save}
          disabled={!title || !videoUrl || (!isShopAd && !selectedProductId) || saving}
          activeOpacity={0.9}
        >
          {saving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.primaryBtnTxt}>PUBLISH VIDEO AD</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>Your Video Feed</Text>
      <SellerVideoFeed sellerId={data.seller._id} />
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1eee9' },
  switchLabel: { fontSize: 14, fontWeight: 'bold', color: '#1b1c1c' },
  switchDesc: { fontSize: 11, color: '#8e9e95', marginTop: 2, fontWeight: '600' },
  targetSection: { paddingTop: 8, gap: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '900', color: '#a63f00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
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
  inputWrap: { gap: 4 },
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
});
