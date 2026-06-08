'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, Edit3, PackagePlus, Search, X, FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CatalogAttributeFields } from '@/components/catalog/CatalogAttributeFields';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { CatalogCategory, ProductVariantDraft, categoryFor, fallbackCatalogCategories } from '@/lib/catalog';
import { productApi, sellerApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';

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
  const router = useRouter();
  const productPath = user?.id ? `/products?sellerId=${user.id}` : '';
  const { data: products, execute: fetchProducts, loading: productsLoading } = useApi<Product[]>(productApi, 'get', productPath);

  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : '';
  const { data: profile } = useApi<any>(sellerApi, 'get', profileUrl);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
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

  const downloadSample = async () => {
    const toastId = toast.loading('Generating premium Excel template...');
    try {
      const response = await productApi.get('/products/bulk/template', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'rmf_bulk_product_template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Excel template downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to download template: ' + (err.message || 'Server error'), { id: toastId });
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return toast.error('Please select a CSV or Excel file to upload.');
    if (!user?.id) return toast.error('Seller ID not resolved. Please sign in again.');

    setIsBulkUploading(true);
    const toastId = toast.loading(`Uploading and parsing ${bulkFile.name}...`);
    const uploadFormData = new FormData();
    uploadFormData.append('file', bulkFile);
    uploadFormData.append('sellerId', user.id);

    try {
      const res = await productApi.post('/products/bulk-upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { total, success, failed, errors } = res.data.data;
      setBulkResult({ total, success, failed, errors });
      
      toast.success(`Bulk upload complete! ${success} imported, ${failed} failed.`, { id: toastId, duration: 5000 });
      setBulkFile(null);
      fetchProducts();
    } catch (err: any) {
      toast.error('Bulk upload failed: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
      setIsBulkUploading(false);
    }
  };

  useEffect(() => {
    productApi.get('/products/catalog/categories')
      .then(res => {
        if (Array.isArray(res.data?.data)) setCatalogCategories(res.data.data);
      })
      .catch(() => setCatalogCategories(fallbackCatalogCategories));
  }, []);

  const rootCategories = useMemo(() => {
    const CORE_ROOT_IDS = [
      'grocery', 'fashion', 'shoes', 'sportswear', 'bakery', 
      'hardware', 'handicrafts', 'home', 'electronics', 
      'cosmetics', 'automotive', 'education', 'other'
    ];
    return catalogCategories.filter(cat => !cat.parentId && CORE_ROOT_IDS.includes(cat.id));
  }, [catalogCategories]);

  const allProducts = useMemo(() => Array.isArray(products) ? products : [], [products]);
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allProducts.filter((product) => {
      const matchesSearch = !query
        || product.name?.toLowerCase().includes(query)
        || product.description?.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'ALL' || 
        (product.categoryId && (product.categoryId === selectedCategory || product.categoryId.startsWith(selectedCategory + '-'))) ||
        (product.category && (product.category === selectedCategory || product.category.startsWith(selectedCategory + '-')));
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
    router.push('/seller/products/new');
  };

  const openEdit = (product: Product) => {
    router.push(`/seller/products/${product._id}/edit`);
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
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6b00]">Inventory Management</p>
            <h1 className="text-4xl font-black tracking-normal text-[#1b1c1c]">My Products</h1>
            <div className="mt-4 flex items-center gap-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#414844] opacity-70">{allProducts.length} total</p>
              <div className="h-1 w-1 rounded-full bg-[#ff6b00]" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#ff6b00]">{visibleProducts.length} of {filteredProducts.length} shown</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller/bulk-upload"
              className="inline-flex items-center gap-3 rounded-md border border-[#e05300] bg-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#e05300] shadow-sm transition hover:bg-[#fcf9f8]"
            >
              <FileSpreadsheet size={16} />
              Bulk Upload
            </Link>
            {profile?.capabilities?.bulk && (
              <button
                type="button"
                onClick={() => setShowBulkUpload(!showBulkUpload)}
                className={`inline-flex items-center gap-3 rounded-md border px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] shadow-sm transition ${
                  showBulkUpload
                    ? 'border-[#ff6b00] bg-[#ff6b00] text-white'
                    : 'border-[#e05300] bg-white text-[#e05300] hover:bg-[#fcf9f8]'
                }`}
              >
                <FileSpreadsheet size={16} />
                {showBulkUpload ? 'Close Bulk Import' : 'Quick Import'}
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-3 rounded-md bg-[#e05300] px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-sm transition hover:bg-[#ff6b00]"
            >
              <PackagePlus size={16} />
              Add New
            </button>
          </div>
        </section>

        {showBulkUpload && (
          <section className="animate-reveal rounded-lg border border-[#d9e0db] bg-white p-8 shadow-sm relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#ff6b00]"></div>
            <div className="flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6b00]">Bulk Operations Activated</p>
                <h3 className="text-2xl font-black text-[#1b1c1c] mt-1">Bulk Product Import</h3>
                <p className="text-xs text-[#414844] mt-2 max-w-xl opacity-75">
                  Import multiple products directly using a CSV spreadsheet template. Perfect for fast inventory listing and catalog synchronization.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex items-center gap-2 rounded-md border border-[#d9e0db] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] hover:border-[#ff6b00] transition"
              >
                <Download size={13} />
                Template CSV
              </button>
            </div>

            {bulkResult ? (
              <div className="border border-[#edf1ee] rounded-md p-6 bg-[#fcf9f8] space-y-4">
                <div className="flex items-center gap-3 text-lg font-black text-[#1b1c1c]">
                  {bulkResult.failed === 0 ? (
                    <CheckCircle2 className="text-[#80c29a]" size={22} />
                  ) : (
                    <AlertCircle className="text-red-500" size={22} />
                  )}
                  Import Complete
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border border-[#d9e0db] bg-white p-4 rounded text-center">
                    <p className="text-xs font-black uppercase tracking-wider text-[#414844] opacity-60">Total Rows</p>
                    <p className="text-3xl font-black text-[#1b1c1c] mt-2">{bulkResult.total}</p>
                  </div>
                  <div className="border border-[#e05300]/20 bg-green-50/10 p-4 rounded text-center">
                    <p className="text-xs font-black uppercase tracking-wider text-[#ff6b00]">Successful</p>
                    <p className="text-3xl font-black text-[#ff6b00] mt-2">{bulkResult.success}</p>
                  </div>
                  <div className={`border p-4 rounded text-center ${bulkResult.failed > 0 ? 'border-red-200 bg-red-50/10' : 'border-[#d9e0db] bg-white'}`}>
                    <p className="text-xs font-black uppercase tracking-wider text-[#7b3f3f]">Failed</p>
                    <p className="text-3xl font-black text-[#7b3f3f] mt-2">{bulkResult.failed}</p>
                  </div>
                </div>

                {bulkResult.failed > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b3f3f]">Error Logs</p>
                    <div className="max-h-40 overflow-y-auto text-[10px] border border-red-100 bg-red-50/50 p-4 rounded font-mono text-red-700 space-y-1">
                      {bulkResult.errors.map((err: string, i: number) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkResult(null)}
                    className="rounded-md bg-[#e05300] px-6 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#ff6b00] transition"
                  >
                    Upload Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload} className="space-y-4">
                <div className="border-2 border-dashed border-[#b8c7be]/50 rounded-lg p-10 bg-[#f7faf8] text-center relative group hover:border-[#ff6b00] transition">
                  <input
                    type="file"
                    accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <UploadCloud className="text-[#5f7569] group-hover:text-[#ff6b00] transition duration-300" size={36} />
                    <p className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">
                      {bulkFile ? bulkFile.name : 'Select or drag your CSV/Excel spreadsheet'}
                    </p>
                    <p className="text-[10px] text-[#414844] tracking-wider opacity-60">
                      {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5 MB'}
                    </p>
                  </div>
                </div>

                {bulkFile && (
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkFile(null)}
                      className="rounded-md border border-[#d9e0db] px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#405046] hover:border-[#ff6b00] transition"
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={isBulkUploading}
                      className="rounded-md bg-[#e05300] px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#ff6b00] transition disabled:opacity-50"
                    >
                      {isBulkUploading ? 'Processing...' : 'Upload & Import'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </section>
        )}

        <section className="grid grid-cols-1 items-center gap-4 rounded-lg border border-[#d9e0db] bg-white p-4 shadow-sm md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b938d]" size={16} />
            <input
              type="text"
              placeholder="Search by name or description..."
              className="h-11 w-full rounded-md border border-[#d9e0db] bg-white pl-11 pr-4 text-[11px] font-black uppercase tracking-widest outline-none transition focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-8">
            {[{ id: 'ALL', label: 'All Products' }, ...rootCategories].map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-md border px-4 py-2.5 text-[8px] font-black uppercase tracking-widest transition ${
                  selectedCategory === category.id
                    ? 'border-[#e05300] bg-[#e05300] text-white'
                    : 'border-[#d9e0db] bg-white text-[#414844] hover:border-[#ff6b00]'
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
                <tr className="bg-[#e05300] text-white">
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
                            src={product.images?.[0] ? resolveUploadUrl(product.images[0], 'product') : 'https://images.unsplash.com/photo-1590073844006-33379778ae09?auto=format&fit=crop&q=80&w=400'}
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
                        <span className={`rounded-sm border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${product.inStock === false ? 'border-[#d9b8ad] text-[#7b3f3f]' : 'border-[#80c29a] text-[#ff6b00]'}`}>
                          {product.inStock === false ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#d9e0db] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] transition hover:border-[#ff6b00] hover:text-[#ff6b00]"
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
                      <button type="button" onClick={openCreate} className="mt-6 text-[11px] font-black uppercase tracking-widest text-[#ff6b00] hover:underline">
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

        <section className="rounded-lg border border-[#d9e0db] bg-[#e05300] p-6 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ffedd5]">Commercial standards</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Keep photos clear, archive unavailable products instead of erasing them, and mark Made in Rwanda goods accurately so buyers can trust what they see.
          </p>
        </section>
      </div>
    </Layout>
  );
}
