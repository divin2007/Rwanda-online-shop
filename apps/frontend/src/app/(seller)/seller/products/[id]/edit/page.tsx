'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CategoryDrilldownPicker } from '@/components/catalog/CategoryDrilldownPicker';
import { CatalogAttributeFields } from '@/components/catalog/CatalogAttributeFields';
import { useAuth } from '@/context/AuthContext';
import { productApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { CatalogCategory, ProductVariantDraft, categoryFor, fallbackCatalogCategories } from '@/lib/catalog';
import { sanitizeText } from '@/lib/sanitize';

type ApiError = { response?: { data?: { message?: string; error?: string } } };

type EditForm = {
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

const emptyForm: EditForm = {
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

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = String(params?.id || '');
  const { user } = useAuth();

  const [form, setForm] = useState<EditForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(fallbackCatalogCategories);

  useEffect(() => {
    productApi.get('/products/catalog/categories')
      .then(res => {
        if (Array.isArray(res.data?.data)) setCatalogCategories(res.data.data);
      })
      .catch(() => setCatalogCategories(fallbackCatalogCategories));
  }, []);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    productApi.get(`/products/${productId}`)
      .then(res => {
        const product = res.data?.data;
        if (!product) {
          setNotFound(true);
          return;
        }
        setForm({
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
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.images.length === 0) return toast.error('At least one product photo is required');
    if (!form.category) return toast.error('Please choose a product category');
    if (!user?.id) return toast.error('Please sign in again to continue.');

    setIsSubmitting(true);
    try {
      const payload = {
        name: sanitizeText(form.name, 160),
        description: sanitizeText(form.description, 4000),
        category: form.category,
        categoryId: form.category,
        price: Number(form.price),
        unit: form.unit,
        stockType: form.stockType,
        stockQuantity: form.stockType === 'finite' ? Number(form.stockQuantity) : 999999,
        weight: Number(form.weight) || 0,
        isMadeInRwanda: form.isMadeInRwanda,
        isNegotiable: form.isNegotiable,
        images: form.images,
        attributes: form.attributes,
        variants: form.variants,
        sellerId: user.id,
      };
      await productApi.put(`/products/${productId}`, payload);
      toast.success('Product updated successfully!');
      router.push('/seller/products');
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || apiError.response?.data?.error || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await productApi.delete(`/products/${productId}`, {
        data: { deletedBy: user?.id, reason: 'seller_deleted_from_edit' },
      });
      toast.success('Product deleted.');
      router.push('/seller/products');
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || apiError.response?.data?.error || 'Delete failed.');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-20">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-[#ffedd5]/60" />
            <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-t-[#ea580c]" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#414844] opacity-60">Loading product…</p>
        </div>
      </Layout>
    );
  }

  if (notFound) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl space-y-6 px-4 py-24 text-center">
          <AlertTriangle className="mx-auto text-[#e05300]" size={44} />
          <h1 className="text-2xl font-black text-[#1b1c1c]">Product not found</h1>
          <p className="text-sm font-semibold text-[#5f7569]">This product may have been removed, or you don’t have access to it.</p>
          <button onClick={() => router.push('/seller/products')} className="inline-flex h-11 items-center justify-center rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white">
            Back to products
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 animate-reveal">
        <div>
          <button onClick={() => router.push('/seller/products')} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to products
          </button>
          <div className="mt-4 flex items-end justify-between gap-4 border-b-2 border-[#e0e0e0] pb-6">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#ff6b00]">Seller · Edit</p>
              <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Edit Product</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#d9b8ad] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#7b3f3f] transition hover:border-[#7b3f3f] hover:bg-[#fff5f3]"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm md:p-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Product name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border-b-2 border-[#e0e0e0] bg-transparent p-3 text-xl font-sans outline-none focus:border-[#ff6b00]"
                  placeholder="e.g. Handwoven Agaseke Basket"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Category</label>
                <CategoryDrilldownPicker
                  categories={catalogCategories}
                  value={form.category}
                  onChange={(categoryId, category) => setForm(curr => ({
                    ...curr,
                    category: categoryId,
                    unit: category.defaultUnit || curr.unit || 'pcs',
                  }))}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Product photos</label>
                <div className="grid grid-cols-2 gap-4">
                  {form.images.map((img, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-[#e0e0e0]">
                      <img src={resolveUploadUrl(img, 'product')} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, images: form.images.filter((_, idx) => idx !== i) })}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center bg-red-500 text-xs font-black text-white shadow-lg"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {form.images.length < 4 && (
                    <div className="flex aspect-square items-center justify-center border-2 border-dashed border-[#e0e0e0] bg-[#fcf9f8]">
                      <ImageUpload service="product" endpoint="/products/upload-image" onUploadSuccess={url => setForm(curr => ({ ...curr, images: [...curr.images, url] }))} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8 rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Price (RWF)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full border border-[#e0e0e0] bg-white p-4 text-2xl font-sans outline-none focus:border-[#ff6b00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Stock type</label>
                  <select
                    value={form.stockType}
                    onChange={e => setForm({ ...form, stockType: e.target.value as EditForm['stockType'] })}
                    className="w-full border border-[#e0e0e0] bg-white p-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                  >
                    <option value="finite">Limited stock</option>
                    <option value="infinite">Always available</option>
                    <option value="on_demand">Made to order</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-[#e0e0e0] bg-white p-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                  />
                </div>
              </div>

              {form.stockType === 'finite' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Quantity in stock</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={form.stockQuantity}
                    onChange={e => setForm({ ...form, stockQuantity: e.target.value })}
                    className="w-full border border-[#e0e0e0] bg-white p-4 text-xl font-bold outline-none focus:border-[#ff6b00]"
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                  className="w-full border border-[#e0e0e0] bg-white p-4 text-xl font-bold outline-none focus:border-[#ff6b00]"
                />
              </div>

              <div className="space-y-3 border-t border-[#e0e0e0] pt-5">
                <label className="flex cursor-pointer items-center gap-4">
                  <input type="checkbox" className="h-5 w-5 accent-[#e05300]" checked={form.isMadeInRwanda} onChange={e => setForm({ ...form, isMadeInRwanda: e.target.checked })} />
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#1b1c1c]">Made in Rwanda</span>
                </label>
                <label className="flex cursor-pointer items-center gap-4">
                  <input type="checkbox" className="h-5 w-5 accent-[#e05300]" checked={form.isNegotiable} onChange={e => setForm({ ...form, isNegotiable: e.target.checked })} />
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#1b1c1c]">Price is negotiable</span>
                </label>
              </div>
            </div>
          </div>

          {form.category && (
            <CatalogAttributeFields
              category={categoryFor(catalogCategories, form.category)}
              attributes={form.attributes}
              onAttributesChange={attributes => setForm({ ...form, attributes })}
              variants={form.variants}
              onVariantsChange={variants => setForm({ ...form, variants })}
            />
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Description</label>
            <textarea
              required
              rows={6}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-[#e0e0e0] bg-[#fcf9f8] p-5 text-sm leading-relaxed outline-none focus:border-[#ff6b00]"
              placeholder="Describe your product — materials, dimensions, care instructions, etc."
            />
          </div>

          <div className="flex items-center justify-between border-t-2 border-[#e0e0e0] pt-8">
            <button type="button" onClick={() => router.push('/seller/products')} className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40 transition hover:text-[#1b1c1c]">
              ← Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#e05300] px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#1b1c1c]/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-2xl animate-reveal">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#fff5f3] text-[#7b3f3f]">
              <AlertTriangle size={22} />
            </div>
            <h2 className="text-xl font-black text-[#1b1c1c]">Delete this product?</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#5f7569]">
              “{sanitizeText(form.name || 'This product')}” will be removed from your storefront. The record and audit trail are retained.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-md border border-[#d9e0db] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#405046] transition hover:border-[#ff6b00] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-[#7b3f3f] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#5f2f2f] disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
