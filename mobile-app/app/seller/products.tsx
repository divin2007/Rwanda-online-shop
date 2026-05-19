import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { ProductCard } from '../../src/components/Cards';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Product } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type InventoryPayload = {
  products: Product[];
  categories: CatalogCategory[];
};

export default function SellerProductsScreen() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [madeInRwanda, setMadeInRwanda] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [variantTitle, setVariantTitle] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantVideoUrl, setVariantVideoUrl] = useState('');
  const [variantThumbnailUrl, setVariantThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refreshing, error, refresh, setData } = useRemote<InventoryPayload>(async () => {
    const [products, categories] = await Promise.all([
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}&isActive=true`),
      api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    ]);
    const normalizedCategories = asArray<CatalogCategory>(categories).filter(category => category.isActive !== false);
    const firstCategory = normalizedCategories.find(category => category.isActive !== false);
    if (!categoryId && firstCategory?.id) setCategoryId(firstCategory.id);
    return { products: asArray<Product>(products), categories: normalizedCategories };
  }, [user?.id]);

  const selectedCategory = useMemo(() => data?.categories.find(category => category.id === categoryId), [categoryId, data?.categories]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Choose a product photo to publish a listing.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.85 });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || `product-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    } as any);
    try {
      const uploaded = await api.post<{ url: string }>('product', '/products/upload-image', form, { formData: true });
      setImageUrl(uploaded.url);
    } catch (err) {
      Alert.alert('Image upload failed', err instanceof Error ? err.message : 'Could not upload this image.');
    }
  };

  const resetForm = () => {
    setEditingProductId(null);
    setShowForm(false);
    setName('');
    setPrice('');
    setUnit('');
    setStockQuantity('');
    setDescription('');
    setAttributes({});
    setImageUrl('');
    setMadeInRwanda(false);
    setNegotiable(false);
    setVariantTitle('');
    setVariantSku('');
    setVariantVideoUrl('');
    setVariantThumbnailUrl('');
  };

  const beginEdit = (product: Product) => {
    setEditingProductId(product._id);
    setShowForm(true);
    setName(product.name || '');
    setPrice(String(product.price || ''));
    setUnit(product.unit || '');
    setStockQuantity(String(product.stockQuantity ?? ''));
    setDescription(product.description || '');
    setCategoryId(product.categoryId || product.category || data?.categories[0]?.id || '');
    setAttributes(Object.fromEntries(Object.entries(product.attributes || {}).map(([key, value]) => [key, String(value ?? '')])));
    setImageUrl(product.images?.find(Boolean) || '');
    setMadeInRwanda(Boolean(product.isMadeInRwanda));
    setNegotiable(Boolean(product.isNegotiable));
    const firstVariant = product.variants?.[0];
    setVariantTitle(firstVariant?.title || '');
    setVariantSku(firstVariant?.sku || '');
    setVariantVideoUrl(firstVariant?.videoUrl || '');
    setVariantThumbnailUrl(firstVariant?.thumbnailUrl || '');
  };

  const saveProduct = async () => {
    if (!selectedCategory || !name.trim() || !price.trim() || !unit.trim() || !imageUrl) {
      Alert.alert('Missing fields', 'Name, price, unit, category, and product image are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category: selectedCategory.id,
        categoryId: selectedCategory.id,
        categoryLabel: selectedCategory.label,
        productType: selectedCategory.productType || selectedCategory.id,
        price: Number(price),
        unit: unit.trim(),
        stockType: 'finite',
        stockQuantity: Number(stockQuantity || 0),
        inStock: Number(stockQuantity || 0) > 0,
        images: [imageUrl],
        attributes,
        variants: variantTitle.trim() || variantVideoUrl.trim() ? [{
          title: variantTitle.trim() || `${name.trim()} variant`,
          sku: variantSku.trim() || undefined,
          options: {},
          price: 0,
          unit: unit.trim(),
          stockType: 'finite',
          stockQuantity: Number(stockQuantity || 0),
          inStock: Number(stockQuantity || 0) > 0,
          images: [imageUrl],
          videoUrl: variantVideoUrl.trim() || undefined,
          thumbnailUrl: variantThumbnailUrl.trim() || undefined,
          isActive: true,
        }] : [],
        isMadeInRwanda: madeInRwanda,
        isNegotiable: negotiable,
      };
      const saved = editingProductId
        ? await api.put<Product>('product', `/products/${editingProductId}`, payload)
        : await api.post<Product>('product', '/products', payload);

      setData({
        products: editingProductId
          ? (data?.products || []).map(product => product._id === editingProductId ? saved : product)
          : [saved, ...(data?.products || [])],
        categories: data?.categories || [],
      });
      resetForm();
    } catch (err) {
      Alert.alert('Product rejected', err instanceof Error ? err.message : 'Product service rejected this listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    Alert.alert('Remove product', `Remove ${product.name} from active inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await api.delete('product', `/products/${product._id}`, { reason: 'Seller removed from mobile inventory' });
          setData({ products: (data?.products || []).filter(item => item._id !== product._id), categories: data?.categories || [] });
        },
      },
    ]);
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{data?.products.length || 0} live product records</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => showForm ? resetForm() : setShowForm(true)}>
          <Text style={styles.addText}>{showForm ? 'Close' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {showForm ? (
        <View style={styles.form}>
          <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : (
              <>
                <ImagePlus color={colors.orange} size={24} />
                <Text style={styles.imageUploadText}>Upload product image</Text>
              </>
            )}
          </TouchableOpacity>

          <Field label="Product name" value={name} onChangeText={setName} placeholder="Name buyers will see" />
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="RWF" />
          <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="kg, piece, pair..." />
          <Field label="Stock quantity" value={stockQuantity} onChangeText={setStockQuantity} keyboardType="numeric" placeholder="Available quantity" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Seller product details" multiline />

          <View style={styles.categoryPanel}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryGrid}>
              {data?.categories.map(category => (
                <TouchableOpacity key={category.id} style={[styles.pill, categoryId === category.id && styles.pillActive]} onPress={() => setCategoryId(category.id)}>
                  <Text style={[styles.pillText, categoryId === category.id && styles.pillTextActive]}>{category.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedCategory?.attributes?.length ? (
            <View style={styles.categoryPanel}>
              <Text style={styles.sectionTitle}>Category attributes</Text>
              {selectedCategory.attributes.map(attribute => (
                <Field
                  key={attribute.key}
                  label={`${attribute.label}${attribute.required ? ' *' : ''}`}
                  value={attributes[attribute.key] || ''}
                  onChangeText={value => setAttributes(current => ({ ...current, [attribute.key]: value }))}
                  placeholder={attribute.options?.join(', ') || attribute.unit || attribute.label}
                  keyboardType={attribute.type === 'number' ? 'numeric' : 'default'}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.categoryPanel}>
            <Text style={styles.sectionTitle}>Variant video</Text>
            <Text style={styles.helper}>Optional. Use this when a specific variant needs its own product demo.</Text>
            <Field label="Variant title" value={variantTitle} onChangeText={setVariantTitle} placeholder="Large / blue / 25kg" />
            <Field label="Variant SKU" value={variantSku} onChangeText={setVariantSku} placeholder="Optional SKU" />
            <Field label="Variant video URL" value={variantVideoUrl} onChangeText={setVariantVideoUrl} placeholder="https://..." />
            <Field label="Video thumbnail URL" value={variantThumbnailUrl} onChangeText={setVariantThumbnailUrl} placeholder="https://..." />
          </View>

          <View style={styles.toggleRow}><Text style={styles.toggleText}>Made in Rwanda</Text><Switch value={madeInRwanda} onValueChange={setMadeInRwanda} trackColor={{ true: colors.orangeSoft }} thumbColor={madeInRwanda ? colors.orange : colors.faint} /></View>
          <View style={styles.toggleRow}><Text style={styles.toggleText}>Negotiable</Text><Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ true: colors.orangeSoft }} thumbColor={negotiable ? colors.orange : colors.faint} /></View>

          <PrimaryButton label={editingProductId ? 'Update listing' : 'Publish listing'} onPress={saveProduct} loading={submitting} />
        </View>
      ) : null}

      {data?.products.length ? (
        <View style={styles.grid}>
          {data.products.map(product => (
            <View key={product._id} style={styles.productWrap}>
              <ProductCard product={product} compact onPress={() => undefined} />
              <View style={styles.productActions}>
                <Text style={styles.productPrice}>{money(product.price)}</Text>
                <TouchableOpacity onPress={() => beginEdit(product)} style={styles.edit}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteProduct(product)} style={styles.remove}>
                  <Trash2 color={colors.danger} size={14} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyBlock title="No products yet" body="Add your first live listing with an uploaded image and category attributes." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  addButton: { height: 40, borderRadius: 8, backgroundColor: colors.orange, paddingHorizontal: 16, justifyContent: 'center' },
  addText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  form: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  imageUpload: { height: 160, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 8 },
  imageUploadText: { color: colors.orangeDark, fontSize: 12, fontWeight: '900' },
  categoryPanel: { gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8 },
  pillActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: colors.orangeDark },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  productWrap: { width: '48%', gap: 8 },
  productActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productPrice: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  edit: { minWidth: 44, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  editText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  remove: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
});
