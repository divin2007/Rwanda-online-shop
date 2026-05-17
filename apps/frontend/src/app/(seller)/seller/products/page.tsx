'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Edit3, PackagePlus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CatalogAttributeFields } from '@/components/catalog/CatalogAttributeFields';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { CatalogCategory, ProductVariantDraft, categoryFor, fallbackCatalogCategories } from '@/lib/catalog';
import { productApi } from '@/lib/api';

type Product = {
  _id: string;
  name?: string;
  description?: string;
  category?: string;
  categoryId?: string;
  categoryLabel?: string;
  price?: number;
  unit?: string;
  stockType?: 'finite' | 'infinite' | 'on_demand';
  stockQuantity?: number;
  weight?: number;
  images?: string[];
  inStock?: boolean;
  isMadeInRwanda?: boolean;
  isNegotiable?: boolean;
  attributes?: Record<string, unknown>;
  variants?: ProductVariantDraft[];
  variantAxes?: Array<{ key: string; label: string; values?: string[] }>;
};

type ProductForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  unit: string;
  stockType: 'finite' | 'infinite' | 'on_demand';
  stockQuantity: string;
  weight: string;
  isMadeInRwanda: boolean;
  isNegotiable: boolean;
  images: string[];
  attributes: Record<string, unknown>;
  variants: ProductVariantDraft[];
};

type ApiError = { response?: { data?: { error?: string; message?: string } } };

const emptyForm: ProductForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  unit: 'pcs',
  stockType: 'finite',
  stockQuantity: '',
  weight: '',
  isMadeInRwanda: true,
  isNegotiable: false,
  images: [],
  attributes: {},
  variants: [],
};

const toForm = (product: Product): ProductForm => ({
  name: product.name || '',
  description: product.description || '',
  category: product.categoryId || product.category || '',
  price: product.price?.toString() || '',
  unit: product.unit || 'pcs',
  stockType: product.stockType || 'finite',
  stockQuantity: product.stockQuantity?.toString() || '',
  weight: product.weight?.toString() || '',
  isMadeInRwanda: product.isMadeInRwanda ?? true,
  isNegotiable: product.isNegotiable ?? false,
  images: product.images || [],
  attributes: product.attributes || {},
  variants: product.variants || [],
});

export default function SellerProductsPage() {
  const { user } = useAuth();
  const productPath = user?.id ? `/products?sellerId=${user.id}` : '';
  const { data: products, execute: fetchProducts, loading: productsLoading } = useApi<Product[]>(productApi, 'get', productPath);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(24);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(fallbackCatalogCategories);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.id) fetchProducts();
  }, [fetchProducts, user?.id]);

  useEffect(() => {
    productApi.get('/products/catalog/categories')
      .then(res => {
        if (Array.isArray(res.data?.data)) setCatalogCategories(res.data.data);
      })
      .catch(() => setCatalogCategories(fallbackCatalogCategories));
  }, []);

  const allProducts = useMemo(() => Array.isArray(products) ? products : [], [products]);
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allProducts.filter((product) => {
      const matchesSearch = !query
        || product.name?.toLowerCase().includes(query)
        || product.description?.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'ALL' || product.categoryId === selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, searchTerm, selectedCategory]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMoreProducts = visibleCount < filteredProducts.length;

  useEffect(() => {
    setVisibleCount(24);
  }, [allProducts.length, searchTerm, selectedCategory]);

  useEffect(() => () => {
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreProducts || isLoadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setIsLoadingMore(true);
      loadMoreTimerRef.current = setTimeout(() => {
        setVisibleCount(count => Math.min(count + 24, filteredProducts.length));
        setIsLoadingMore(false);
      }, 250);
    }, { rootMargin: '240px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredProducts.length, hasMoreProducts, isLoadingMore]);

  const openCreate = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(toForm(product));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return toast.error('Please sign in again before saving products.');
    if (formData.images.length === 0) return toast.error('At least one product image is required.');

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        categoryId: formData.category,
        price: Number(formData.price),
        stockQuantity: formData.stockType === 'finite' ? Number(formData.stockQuantity || 0) : 999999,
        weight: Number(formData.weight) || 0,
        sellerId: user.id,
        updatedBy: user.id,
      };

      if (editingProduct?._id) {
        await productApi.put(`/products/${editingProduct._id}`, payload);
        toast.success('Product updated successfully.');
      } else {
        await productApi.post('/products', payload);
        toast.success('Product added successfully.');
      }

      closeModal();
      fetchProducts();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || apiError.response?.data?.error || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (product: Product) => {
    if (!product._id) return;
    const confirmed = window.confirm('Archive this product? It will disappear from the storefront, but the record and audit trail stay available.');
    if (!confirmed) return;

    try {
      await productApi.delete(`/products/${product._id}`, {
        data: { deletedBy: user?.id, reason: 'seller_archived_from_inventory' },
      });
      toast.success('Product archived securely.');
      fetchProducts();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || apiError.response?.data?.error || 'Archive failed.');
    }
  };

  return (
    <Layout>
      <div className="animate-reveal space-y-8 pb-20">
        <section className="flex flex-col items-start justify-between gap-6 rounded-lg border border-[#d9e0db] bg-white p-5 shadow-sm md:flex-row md:items-center md:p-6">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#1b4332]">Inventory Management</p>
            <h1 className="text-4xl font-black tracking-normal text-[#1b1c1c]">My Products</h1>
            <div className="mt-4 flex items-center gap-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#414844] opacity-70">{allProducts.length} total</p>
              <div className="h-1 w-1 rounded-full bg-[#1b4332]" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1b4332]">{visibleProducts.length} of {filteredProducts.length} shown</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-3 rounded-md bg-[#012d1d] px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-sm transition hover:bg-[#1b4332]"
          >
            <PackagePlus size={16} />
            Add New
          </button>
        </section>

        <section className="grid grid-cols-1 items-center gap-4 rounded-lg border border-[#d9e0db] bg-white p-4 shadow-sm md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b938d]" size={16} />
            <input
              type="text"
              placeholder="Search by name or description..."
              className="h-11 w-full rounded-md border border-[#d9e0db] bg-white pl-11 pr-4 text-[11px] font-black uppercase tracking-widest outline-none transition focus:border-[#1b4332] focus:ring-2 focus:ring-[#c1ecd4]"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-8">
            {[{ id: 'ALL', label: 'All Products' }, ...catalogCategories].map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-md border px-4 py-2.5 text-[8px] font-black uppercase tracking-widest transition ${
                  selectedCategory === category.id
                    ? 'border-[#012d1d] bg-[#012d1d] text-white'
                    : 'border-[#d9e0db] bg-white text-[#414844] hover:border-[#1b4332]'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#d9e0db] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="bg-[#012d1d] text-white">
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Product</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Price</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Availability</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Status</th>
                  <th className="p-5 text-right text-[9px] font-black uppercase tracking-[0.26em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ee]">
                {productsLoading ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="p-5">
                        <div className="h-16 rounded-md bg-[#f0eded]" />
                      </td>
                    </tr>
                  ))
                ) : visibleProducts.length > 0 ? (
                  visibleProducts.map(product => (
                    <tr key={product._id} className="transition-colors hover:bg-[#fcf9f8]">
                      <td className="flex items-center gap-4 p-5">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-[#e0e0e0] bg-[#fcf9f8]">
                          <img
                            src={product.images?.[0] || 'https://images.unsplash.com/photo-1590073844006-33379778ae09?auto=format&fit=crop&q=80&w=400'}
                            alt={product.name || 'Product'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="text-base font-black tracking-normal text-[#1b1c1c]">{product.name || 'Untitled product'}</h4>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#5f7569]">{product.categoryLabel || product.category || 'other'}</p>
                        </div>
                      </td>
                      <td className="p-5 text-base font-black text-[#1b1c1c]">
                        {(product.price || 0).toLocaleString()} <span className="text-[9px] uppercase text-[#5f7569]">RWF</span>
                      </td>
                      <td className="p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">
                          {product.stockType === 'infinite' ? 'Unlimited' : `${product.stockQuantity || 0} ${product.unit || 'pcs'}`}
                        </p>
                        <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-[#5f7569]">Stock type: {product.stockType || 'finite'}</p>
                      </td>
                      <td className="p-5">
                        <span className={`rounded-sm border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${product.inStock === false ? 'border-[#d9b8ad] text-[#7b3f3f]' : 'border-[#80c29a] text-[#1b4332]'}`}>
                          {product.inStock === false ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#d9e0db] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] transition hover:border-[#1b4332] hover:text-[#1b4332]"
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(product)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#d9e0db] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#7b3f3f] transition hover:border-[#7b3f3f]"
                          >
                            <Archive size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-16 text-center">
                      <p className="text-[12px] font-black uppercase tracking-[0.3em] text-[#5f7569]">No products match this view</p>
                      <button type="button" onClick={openCreate} className="mt-6 text-[11px] font-black uppercase tracking-widest text-[#1b4332] hover:underline">
                        Add your first product
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div ref={loadMoreRef} className="min-h-1" />
          {isLoadingMore && (
            <div className="border-t border-[#edf1ee] p-5">
              <div className="grid gap-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-md bg-[#f0eded]" />)}
              </div>
            </div>
          )}
          {!isLoadingMore && hasMoreProducts && (
            <div className="border-t border-[#edf1ee] p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#5f7569]">
              Scroll to load more products
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#d9e0db] bg-[#012d1d] p-6 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#c1ecd4]">Commercial standards</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Keep photos clear, archive unavailable products instead of erasing them, and mark Made in Rwanda goods accurately so buyers can trust what they see.
          </p>
        </section>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#012d1d]/60 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[#d9e0db] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#d9e0db] bg-[#012d1d] px-5 py-4 text-white">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#c1ecd4]">Inventory listing</p>
                  <h2 className="mt-1 text-2xl font-black">{editingProduct ? 'Edit product' : 'Add product'}</h2>
                </div>
                <button type="button" onClick={closeModal} className="rounded-md border border-white/20 p-2 text-white/80 transition hover:bg-white hover:text-[#012d1d]" aria-label="Close product editor">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="max-h-[calc(92vh-88px)] overflow-y-auto p-5 md:p-6">
                <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Name</span>
                      <input required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332] focus:ring-2 focus:ring-[#c1ecd4]" />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Description</span>
                      <textarea required rows={5} value={formData.description} onChange={event => setFormData({ ...formData, description: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332] focus:ring-2 focus:ring-[#c1ecd4]" />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Category</span>
                        <select required value={formData.category} onChange={event => setFormData({ ...formData, category: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332]">
                          <option value="">Select category</option>
                          {catalogCategories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Price (RWF)</span>
                        <input required type="number" min="0" value={formData.price} onChange={event => setFormData({ ...formData, price: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332]" />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Stock Type</span>
                        <select value={formData.stockType} onChange={event => setFormData({ ...formData, stockType: event.target.value as ProductForm['stockType'] })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332]">
                          <option value="finite">Finite</option>
                          <option value="infinite">Infinite</option>
                          <option value="on_demand">On Demand</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Quantity</span>
                        <input disabled={formData.stockType !== 'finite'} required={formData.stockType === 'finite'} type="number" min="0" value={formData.stockQuantity} onChange={event => setFormData({ ...formData, stockQuantity: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none disabled:bg-[#f7faf8] focus:border-[#1b4332]" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Unit</span>
                        <select value={formData.unit} onChange={event => setFormData({ ...formData, unit: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332]">
                          <option value="pcs">Pieces</option>
                          <option value="kg">Kilograms</option>
                          <option value="pair">Pairs</option>
                          <option value="set">Set</option>
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Weight (kg)</span>
                      <input type="number" min="0" step="0.01" value={formData.weight} onChange={event => setFormData({ ...formData, weight: event.target.value })} className="w-full rounded-md border border-[#d9e0db] px-4 py-3 text-sm outline-none focus:border-[#1b4332]" />
                    </label>

                    {formData.category && (
                      <CatalogAttributeFields
                        category={categoryFor(catalogCategories, formData.category)}
                        attributes={formData.attributes}
                        onAttributesChange={attributes => setFormData({ ...formData, attributes })}
                        variants={formData.variants}
                        onVariantsChange={variants => setFormData({ ...formData, variants })}
                      />
                    )}
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#1b1c1c]">Product images</p>
                      <div className="grid grid-cols-2 gap-3">
                        {formData.images.map((image, index) => (
                          <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-md border border-[#d9e0db] bg-[#fcf9f8]">
                            <img src={image} alt={`Product image ${index + 1}`} className="h-full w-full object-cover" />
                            <button type="button" onClick={() => setFormData({ ...formData, images: formData.images.filter((_, imageIndex) => imageIndex !== index) })} className="absolute right-2 top-2 rounded-md bg-white p-1 text-[#7b3f3f] shadow" aria-label="Remove image">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {formData.images.length < 4 && (
                          <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[#b8c7be] bg-[#f7faf8] p-3">
                            <ImageUpload
                              service="product"
                              endpoint="/products/upload-image"
                              onUploadSuccess={url => setFormData({ ...formData, images: [...formData.images, url] })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-[#d9e0db] bg-[#f7faf8] p-4">
                      <label className="flex items-center gap-3 text-sm font-bold text-[#1b1c1c]">
                        <input type="checkbox" className="h-4 w-4 accent-[#1b4332]" checked={formData.isMadeInRwanda} onChange={event => setFormData({ ...formData, isMadeInRwanda: event.target.checked })} />
                        Made in Rwanda
                      </label>
                      <label className="flex items-center gap-3 text-sm font-bold text-[#1b1c1c]">
                        <input type="checkbox" className="h-4 w-4 accent-[#1b4332]" checked={formData.isNegotiable} onChange={event => setFormData({ ...formData, isNegotiable: event.target.checked })} />
                        Negotiable product
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#edf1ee] pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={closeModal} className="rounded-md border border-[#d9e0db] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#405046] transition hover:border-[#1b4332]">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="rounded-md bg-[#012d1d] px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#1b4332] disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : editingProduct ? 'Save product' : 'Create product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
