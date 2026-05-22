import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Archive, ImagePlus, Package, Plus, Search, Trash2, X } from 'lucide-react-native';
import { FastImage } from '../../src/components/FastImage';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { asArray, normalizeImageUrl } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { CatalogCategory, Product } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type StockType = 'finite' | 'infinite' | 'on_demand';

type InventoryPayload = {
  products: Product[];
  categories: CatalogCategory[];
};

const STOCK_TYPES: { value: StockType; label: string }[] = [
  { value: 'finite', label: 'Finite (count)' },
  { value: 'infinite', label: 'Unlimited' },
  { value: 'on_demand', label: 'On demand' },
];

export default function SellerProductsScreen() {
  const { user } = useAuth();

  // Form visibility
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Search / filter (matches web)
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('ALL');

  // Form fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [weight, setWeight] = useState('');
  const [stockType, setStockType] = useState<StockType>('finite');
  const [stockQuantity, setStockQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]); // multi-image
  const [inStock, setInStock] = useState(true);
  const [madeInRwanda, setMadeInRwanda] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [variantTitle, setVariantTitle] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantVideoUrl, setVariantVideoUrl] = useState('');
  const [variantThumbnailUrl, setVariantThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);

  const { data, loading, refreshing, error, refresh, setData } = useRemote<InventoryPayload>(async () => {
    const [products, categories] = await Promise.all([
      api.get<Product[]>('product', `/products?sellerId=${encodeURIComponent(user?.id || '')}`),
      api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    ]);
    const normalizedCategories = asArray<CatalogCategory>(categories).filter(c => c.isActive !== false);
    const firstCategory = normalizedCategories[0];
    if (!categoryId && firstCategory?.id) setCategoryId(firstCategory.id);
    return { products: asArray<Product>(products), categories: normalizedCategories };
  }, [user?.id]);

  const selectedCategory = useMemo(
    () => data?.categories.find(c => c.id === categoryId),
    [categoryId, data?.categories],
  );

  const categoriesList = data?.categories || [];

  const branchIds = useMemo(() => {
    const ids = new Set<string>();
    categoriesList.forEach(cat => {
      if (cat.parentId) {
        ids.add(cat.parentId);
      }
    });
    return ids;
  }, [categoriesList]);

  const displayedCategories = useMemo(() => {
    return categoriesList.filter(cat => {
      if (!activeParentId) {
        return !cat.parentId || !categoriesList.some(parent => parent.id === cat.parentId);
      }
      return cat.parentId === activeParentId;
    });
  }, [categoriesList, activeParentId]);

  const getCategoryPath = (cat: CatalogCategory): string => {
    const parts: string[] = [cat.label];
    let parentId = cat.parentId;
    while (parentId) {
      const parent = categoriesList.find(c => c.id === parentId);
      if (parent) {
        parts.unshift(parent.label);
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    return parts.join(' › ');
  };

  const activeParent = activeParentId ? categoriesList.find(c => c.id === activeParentId) : null;

  // Filtered + searched products (matches web)
  const visibleProducts = useMemo(() => {
    const all = data?.products || [];
    const q = search.trim().toLowerCase();
    return all.filter(p => {
      const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      const matchCat = filterCategoryId === 'ALL' || p.categoryId === filterCategoryId || p.category === filterCategoryId;
      return matchSearch && matchCat;
    });
  }, [data?.products, search, filterCategoryId]);

  // Pick multiple images
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to upload product images.'); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const newUrls: string[] = [];
    for (const asset of picked.assets) {
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || `product-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      try {
        const uploaded = await api.post<{ url: string }>('product', '/products/upload-image', form, { formData: true });
        newUrls.push(uploaded.url);
      } catch {
        Alert.alert('Upload failed', 'One image could not be uploaded.');
      }
    }
    setImages(prev => [...prev, ...newUrls]);
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setEditingProductId(null);
    setShowForm(false);
    setName(''); setPrice(''); setUnit(''); setWeight('');
    setStockType('finite'); setStockQuantity('');
    setDescription(''); setAttributes({}); setImages([]);
    setInStock(true); setMadeInRwanda(false); setNegotiable(false);
    setVariantTitle(''); setVariantSku(''); setVariantVideoUrl(''); setVariantThumbnailUrl('');
    setActiveParentId(null);
  };

  const beginEdit = (product: Product) => {
    setEditingProductId(product._id);
    setShowForm(true);
    setName(product.name || '');
    setPrice(String(product.price || ''));
    setUnit(product.unit || '');
    setWeight(String((product as any).weight || ''));
    setStockType((product as any).stockType || 'finite');
    setStockQuantity(String(product.stockQuantity ?? ''));
    setDescription(product.description || '');
    const activeCatId = product.categoryId || product.category || data?.categories[0]?.id || '';
    setCategoryId(activeCatId);
    const editCategory = data?.categories.find(c => c.id === activeCatId);
    setActiveParentId(editCategory?.parentId || null);
    setAttributes(Object.fromEntries(Object.entries(product.attributes || {}).map(([k, v]) => [k, String(v ?? '')])));
    setImages(product.images || []);
    setInStock(product.inStock !== false);
    setMadeInRwanda(Boolean(product.isMadeInRwanda));
    setNegotiable(Boolean(product.isNegotiable));
    const v0 = product.variants?.[0];
    setVariantTitle(v0?.title || '');
    setVariantSku(v0?.sku || '');
    setVariantVideoUrl((v0 as any)?.videoUrl || '');
    setVariantThumbnailUrl((v0 as any)?.thumbnailUrl || '');
  };

  const saveProduct = async () => {
    if (!selectedCategory || !name.trim() || !price.trim() || !unit.trim()) {
      Alert.alert('Missing fields', 'Name, price, unit and category are required.');
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
        productType: (selectedCategory as any).productType || selectedCategory.id,
        price: Number(price),
        unit: unit.trim(),
        weight: weight.trim() ? Number(weight) : undefined,
        stockType,
        stockQuantity: stockType === 'finite' ? Number(stockQuantity || 0) : undefined,
        inStock,
        images,
        attributes,
        variants: variantTitle.trim() || variantVideoUrl.trim() ? [{
          title: variantTitle.trim() || `${name.trim()} variant`,
          sku: variantSku.trim() || undefined,
          options: {},
          price: Number(price),
          unit: unit.trim(),
          stockType,
          stockQuantity: stockType === 'finite' ? Number(stockQuantity || 0) : undefined,
          inStock,
          images,
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
          ? (data?.products || []).map(p => p._id === editingProductId ? saved : p)
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

  // Archive = soft-delete matching web behaviour (DELETE with reason)
  const archiveProduct = async (product: Product) => {
    Alert.alert(
      'Archive product',
      `"${product.name}" will disappear from the storefront but the record stays in your audit trail.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('product', `/products/${product._id}`, {
                deletedBy: user?.id,
                reason: 'seller_archived_from_inventory',
              });
              setData({
                products: (data?.products || []).filter(p => p._id !== product._id),
                categories: data?.categories || [],
              });
            } catch (err) {
              Alert.alert('Archive failed', err instanceof Error ? err.message : 'Could not archive this product.');
            }
          },
        },
      ],
    );
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const categories = data?.categories || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{data?.products.length || 0} products · {visibleProducts.length} shown</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, showForm && styles.addButtonClose]}
          onPress={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? <X color={colors.greenDark} size={16} /> : <Plus color={colors.greenDark} size={16} />}
          <Text style={styles.addText}>{showForm ? 'Close' : 'Add new'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search + category filter (matches web) ────────────── */}
      <View style={styles.searchBar}>
        <Search color={colors.faint} size={16} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or description..."
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X color={colors.faint} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category filter pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'ALL', label: 'All' } as any, ...categories]}
        keyExtractor={item => item.id || 'all'}
        contentContainerStyle={styles.filterStrip}
        renderItem={({ item }) => {
          const active = filterCategoryId === item.id;
          return (
            <TouchableOpacity
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setFilterCategoryId(item.id)}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Product form ──────────────────────────────────────── */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingProductId ? 'Edit listing' : 'New listing'}</Text>

          {/* Multi-image upload */}
          <View style={styles.imagesPanel}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageWrap}>
                <FastImage uri={normalizeImageUrl(img)} style={styles.imageTile} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                  <X color={colors.card} size={10} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addImageTile} onPress={pickImages}>
              <ImagePlus color={colors.orange} size={22} />
              <Text style={styles.addImageText}>Add photos</Text>
            </TouchableOpacity>
          </View>

          <Field label="Product name *" value={name} onChangeText={setName} placeholder="Name buyers will see" />
          <Field label="Price (RWF) *" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 5000" />
          <Field label="Unit *" value={unit} onChangeText={setUnit} placeholder="kg, piece, pair, litre..." />
          <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="For delivery fee calculation" />

          {/* Stock type selector (matches web finite/infinite/on_demand) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.fieldLabel}>Stock type</Text>
            <View style={styles.stockTypeRow}>
              {STOCK_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.stockTypeBtn, stockType === t.value && styles.stockTypeBtnActive]}
                  onPress={() => setStockType(t.value)}
                >
                  <Text style={[styles.stockTypeTxt, stockType === t.value && styles.stockTypeTxtActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {stockType === 'finite' && (
            <Field label="Stock quantity" value={stockQuantity} onChangeText={setStockQuantity} keyboardType="numeric" placeholder="How many available?" />
          )}

          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Seller product details" multiline />

          {/* Category selector */}
          <View style={styles.sectionBlock}>
            <Text style={styles.fieldLabel}>Category *</Text>
            {selectedCategory && (
              <View style={styles.selectedPathContainer}>
                <Text style={styles.selectedPathTitle}>Selected Category:</Text>
                <Text style={styles.selectedPathText}>
                  {getCategoryPath(selectedCategory)}
                </Text>
              </View>
            )}

            {/* Breadcrumb / Back button when deep inside the hierarchy */}
            <View style={styles.drilldownHeader}>
              {activeParentId ? (
                <TouchableOpacity
                  style={styles.backCatBtn}
                  onPress={() => {
                    if (activeParent && activeParent.parentId) {
                      setActiveParentId(activeParent.parentId);
                    } else {
                      setActiveParentId(null);
                    }
                  }}
                >
                  <Text style={styles.backCatTxt}>← Back to {activeParent?.parentId ? 'previous' : 'Top Level'}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.currentLevelTxt}>Top-Level Categories</Text>
              )}
            </View>

            <View style={styles.categoryGrid}>
              {displayedCategories.map(cat => {
                const isBranch = branchIds.has(cat.id);
                const isSelected = categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pill,
                      isSelected && styles.pillActive,
                      isBranch && styles.branchPill,
                    ]}
                    onPress={() => {
                      if (isBranch) {
                        setActiveParentId(cat.id);
                      } else {
                        setCategoryId(cat.id);
                      }
                    }}
                  >
                    <Text style={[
                      styles.pillText,
                      isSelected && styles.pillTextActive,
                      isBranch && styles.branchText,
                    ]}>
                      {cat.label} {isBranch ? '›' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Dynamic category attributes */}
          {selectedCategory?.attributes?.length ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.fieldLabel}>Category attributes</Text>
              {selectedCategory.attributes.map(attr => (
                <Field
                  key={attr.key}
                  label={`${attr.label}${attr.required ? ' *' : ''}`}
                  value={attributes[attr.key] || ''}
                  onChangeText={v => setAttributes(cur => ({ ...cur, [attr.key]: v }))}
                  placeholder={attr.options?.join(', ') || attr.unit || attr.label}
                  keyboardType={attr.type === 'number' ? 'numeric' : 'default'}
                />
              ))}
            </View>
          ) : null}

          {/* Optional variant video */}
          <View style={styles.sectionBlock}>
            <Text style={styles.fieldLabel}>Variant video (optional)</Text>
            <Field label="Variant title" value={variantTitle} onChangeText={setVariantTitle} placeholder="Large / blue / 25kg" />
            <Field label="Variant SKU" value={variantSku} onChangeText={setVariantSku} placeholder="SKU code" />
            <Field label="Video URL" value={variantVideoUrl} onChangeText={setVariantVideoUrl} placeholder="https://..." />
            <Field label="Thumbnail URL" value={variantThumbnailUrl} onChangeText={setVariantThumbnailUrl} placeholder="https://..." />
          </View>

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>In stock</Text>
            <Switch value={inStock} onValueChange={setInStock} trackColor={{ true: colors.orangeSoft }} thumbColor={inStock ? colors.orange : colors.faint} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Made in Rwanda</Text>
            <Switch value={madeInRwanda} onValueChange={setMadeInRwanda} trackColor={{ true: colors.orangeSoft }} thumbColor={madeInRwanda ? colors.orange : colors.faint} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Price negotiable</Text>
            <Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ true: colors.orangeSoft }} thumbColor={negotiable ? colors.orange : colors.faint} />
          </View>

          <PrimaryButton label={editingProductId ? 'Update listing' : 'Publish listing'} onPress={saveProduct} loading={submitting} />
          {editingProductId && (
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Product list ──────────────────────────────────────── */}
      {visibleProducts.length ? (
        visibleProducts.map(product => {
          const thumb = normalizeImageUrl(product.images?.[0]);
          const stockBadge = (product as any).inStock === false ? 'Out of stock' : 'In stock';
          const stockColor = (product as any).inStock === false ? '#dc2626' : '#16a34a';
          return (
            <View key={product._id} style={styles.productRow}>
              {/* Thumbnail */}
              <FastImage
                uri={thumb}
                style={[styles.productThumb, !thumb && styles.productThumbFallback as any]}
                fallback={<Package color={colors.faint} size={18} />}
              />
              {/* Info */}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.productName} numberOfLines={1}>{product.name || 'Unnamed product'}</Text>
                <Text style={styles.productCategory}>{product.categoryLabel || product.category || 'Product'}</Text>
                <View style={styles.productMeta}>
                  <Text style={styles.productPrice}>{money(product.price)}</Text>
                  <Text style={[styles.productStock, { color: stockColor }]}>{stockBadge}</Text>
                </View>
                <Text style={styles.productStockType}>
                  {(product as any).stockType === 'infinite'
                    ? 'Unlimited stock'
                    : (product as any).stockType === 'on_demand'
                    ? 'On demand'
                    : `${product.stockQuantity ?? 0} ${product.unit || 'units'}`}
                </Text>
              </View>
              {/* Actions */}
              <View style={styles.productBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => { beginEdit(product); }}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.archiveBtn} onPress={() => archiveProduct(product)}>
                  <Archive color={colors.danger} size={15} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      ) : !showForm ? (
        <EmptyBlock
          title={search ? 'No results' : 'No products yet'}
          body={search ? 'Try a different keyword.' : 'Add your first live listing with an uploaded image and category attributes.'}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  addButton: { height: 40, borderRadius: 8, backgroundColor: colors.orange, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButtonClose: { backgroundColor: colors.muted },
  addText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  filterStrip: { gap: 8, paddingVertical: 2 },
  pill: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  pillActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: colors.orangeDark },
  // Form
  form: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 14 },
  formTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  imagesPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrap: { position: 'relative' },
  imageTile: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.paper },
  removeImageBtn: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  addImageTile: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.orangeSoft },
  addImageText: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  sectionBlock: { gap: 8 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  stockTypeRow: { flexDirection: 'row', gap: 8 },
  stockTypeBtn: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stockTypeBtnActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  stockTypeTxt: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  stockTypeTxtActive: { color: colors.orangeDark },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { color: colors.ink, fontSize: 13, fontWeight: '800', flex: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  // Product rows
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
  productThumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden' },
  productThumbFallback: { backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  productName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  productCategory: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productPrice: { color: colors.greenDark, fontSize: 13, fontWeight: '900' },
  productStock: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  productStockType: { color: colors.faint, fontSize: 10, fontWeight: '700' },
  productBtns: { gap: 8, alignItems: 'center' },
  editBtn: { height: 32, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  archiveBtn: { width: 32, height: 32, borderRadius: 7, backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center' },
  selectedPathContainer: { backgroundColor: colors.orangeSoft, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.orange, marginVertical: 4 },
  selectedPathTitle: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  selectedPathText: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 2 },
  drilldownHeader: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  backCatBtn: { backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: colors.orange, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  backCatTxt: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  currentLevelTxt: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  branchPill: { borderColor: colors.orange, borderStyle: 'dashed' },
  branchText: { color: colors.orangeDark },
});
