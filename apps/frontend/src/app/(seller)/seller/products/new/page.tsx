'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CatalogAttributeFields } from '@/components/catalog/CatalogAttributeFields';
import { CategoryDrilldownPicker } from '@/components/catalog/CategoryDrilldownPicker';
import { useAuth } from '@/context/AuthContext';
import { productApi, sellerApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { useApi } from '@/hooks/useApi';
import { CatalogCategory, ProductVariantDraft, categoryFor, fallbackCatalogCategories } from '@/lib/catalog';
import toast from 'react-hot-toast';
import { FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertCircle } from 'lucide-react';

type ApiError = { response?: { data?: { message?: string } } };

export default function NewProductPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-8 min-h-[60vh]">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#ffedd5]/60 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-t-[#ea580c] rounded-full animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#414844] opacity-60">Loading product editor...</p>
        </div>
      </Layout>
    }>
      <NewProductPageContent />
    </Suspense>
  );
}

function NewProductPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') || searchParams.get('edit');
  const { user } = useAuth();
  
  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : '';
  const { data: profile } = useApi<any>(sellerApi, 'get', profileUrl);

  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: '', 
    price: '', 
    unit: 'pcs', 
    stockType: 'finite',
    stockQuantity: '', 
    weight: '', 
    minWeight: '',
    maxWeight: '',
    minPrice: '',
    maxPrice: '',
    isMadeInRwanda: true,
    isNegotiable: false,
    images: [] as string[],
    attributes: {} as Record<string, unknown>,
    variants: [] as ProductVariantDraft[],
  });
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(fallbackCatalogCategories);

  useEffect(() => {
    productApi.get('/products/catalog/categories')
      .then(res => {
        if (Array.isArray(res.data?.data)) setCatalogCategories(res.data.data);
      })
      .catch(() => setCatalogCategories(fallbackCatalogCategories));
  }, []);

  // Fetch product to edit
  useEffect(() => {
    if (editId) {
      productApi.get(`/products/${editId}`)
        .then(res => {
          const product = res.data?.data;
          if (product) {
            setFormData({
              name: product.name || '',
              description: product.description || '',
              category: product.categoryId || product.category || '',
              price: product.price?.toString() || '',
              unit: product.unit || 'pcs',
              stockType: product.stockType || 'finite',
              stockQuantity: product.stockQuantity?.toString() || '',
              weight: product.weight?.toString() || '',
              minWeight: product.minWeight?.toString() || '',
              maxWeight: product.maxWeight?.toString() || '',
              minPrice: product.minPrice?.toString() || '',
              maxPrice: product.maxPrice?.toString() || '',
              isMadeInRwanda: product.isMadeInRwanda ?? true,
              isNegotiable: product.isNegotiable ?? false,
              images: product.images || [],
              attributes: product.attributes || {},
              variants: product.variants || [],
            });
          }
        })
        .catch(err => {
          toast.error('Failed to load product details for editing.');
          console.error(err);
        });
    }
  }, [editId]);

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
    } catch (err: any) {
      toast.error('Bulk upload failed: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.images.length === 0) return toast.error('At least one product photo is required');
    if (!formData.category) return toast.error('Please choose an exact product category');
    if (!user?.id) return toast.error('Please log in again to continue.');
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        categoryId: formData.category,
        price: Number(formData.price),
        stockQuantity: formData.stockType === 'finite' ? Number(formData.stockQuantity) : 999999,
        weight: Number(formData.weight) || 0,
        minWeight: formData.minWeight ? Number(formData.minWeight) : undefined,
        maxWeight: formData.maxWeight ? Number(formData.maxWeight) : undefined,
        minPrice: formData.minPrice ? Number(formData.minPrice) : undefined,
        maxPrice: formData.maxPrice ? Number(formData.maxPrice) : undefined,
        sellerId: user.id
      };

      if (editId) {
        await productApi.put(`/products/${editId}`, payload);
        toast.success('Product updated successfully!');
      } else {
        await productApi.post('/products', payload);
        toast.success('Product added successfully!');
      }
      router.push('/seller/products');
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-20 px-6 animate-reveal">
         {/* Page Header */}
         <div className="mb-20 border-b-2 border-[#e0e0e0] pb-12">
            <div className="flex items-center gap-6 mb-8">
               <div className="w-12 h-px bg-[#ff6b00]"></div>
               <p className="text-[11px] font-black text-[#ff6b00] uppercase tracking-[0.5em]">Seller Dashboard</p>
            </div>
            <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
               {editId ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-sm text-[#414844] mt-6 max-w-xl leading-relaxed opacity-70">
               {editId 
                 ? 'Update your product details, specs, stock quantity and photos to keep buyers informed.' 
                 : 'List a new product in your shop. Make sure to include clear photos and an accurate description for better sales.'
               }
            </p>
         </div>

         {profile?.capabilities?.bulk && !editId && (
            <div className="flex border-b border-[#e0e0e0] mb-10 gap-8">
               <button
                  type="button"
                  onClick={() => setActiveTab('single')}
                  className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                     activeTab === 'single' ? 'border-[#ff6b00] text-[#1b1c1c]' : 'border-transparent text-[#1b1c1c]/40 hover:text-[#1b1c1c]'
                  }`}
               >
                  Single Listing
               </button>
               <button
                  type="button"
                  onClick={() => setActiveTab('bulk')}
                  className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                     activeTab === 'bulk' ? 'border-[#ff6b00] text-[#1b1c1c]' : 'border-transparent text-[#1b1c1c]/40 hover:text-[#1b1c1c]'
                  }`}
               >
                  Bulk Import
               </button>
            </div>
         )}

         <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#ff6b00]"></div>
            
            {activeTab === 'single' ? (
              <form onSubmit={handleSubmit} className="p-12 md:p-20 space-y-16">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    {/* Left Column: Name, Category, Images */}
                    <div className="space-y-10">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Product Name</label>
                          <input 
                            type="text" 
                            required 
                            className="w-full border-b-2 border-[#e0e0e0]/10 p-4 text-2xl font-sans outline-none focus:border-[#ff6b00] bg-transparent" 
                            placeholder="e.g. Handwoven Agaseke Basket"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                          />
                       </div>

                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Category</label>
                          <CategoryDrilldownPicker
                            categories={catalogCategories}
                            value={formData.category}
                            onChange={(categoryId, category) => setFormData(current => ({
                              ...current,
                              category: categoryId,
                              unit: category.defaultUnit || current.unit || 'pcs',
                              attributes: {},
                              variants: [],
                            }))}
                          />
                       </div>

                       <div className="space-y-4 pt-6">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 text-center block">Product Photos</label>
                          <div className="grid grid-cols-2 gap-6">
                             {formData.images.map((img, i) => (
                               <div key={i} className="aspect-square border border-[#e0e0e0] rounded-lg relative group overflow-hidden">
                                  <img src={resolveUploadUrl(img, 'product')} alt={`Product image ${i + 1}`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                  <button 
                                    type="button" 
                                    onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)})} 
                                    className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 flex items-center justify-center text-xs font-black shadow-lg"
                                  >
                                     ×
                                  </button>
                               </div>
                             ))}
                             {formData.images.length < 4 && (
                               <div className="aspect-square border-2 border-dashed border-[#e0e0e0]/20 flex items-center justify-center bg-[#fcf9f8]">
                                  <ImageUpload 
                                    service="product" 
                                    endpoint="/products/upload-image" 
                                    onUploadSuccess={url => setFormData({...formData, images: [...formData.images, url]})} 
                                  />
                                </div>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* Right Column: Price, Stock, Weight */}
                    <div className="space-y-12 bg-[#fcf9f8] p-12 border border-[#e0e0e0]">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Price (RWF)</label>
                          <input 
                            type="number" 
                            required 
                            className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-3xl font-sans outline-none focus:border-[#ff6b00]"
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Stock Type</label>
                             <select 
                               className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                               value={formData.stockType}
                               onChange={e => setFormData({...formData, stockType: e.target.value})}
                             >
                                <option value="finite">Limited Stock</option>
                                <option value="infinite">Always Available</option>
                                <option value="on_demand">Made to Order</option>
                             </select>
                          </div>
                          <div className="space-y-4">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Unit</label>
                             <select 
                               className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                               value={formData.unit}
                               onChange={e => setFormData({...formData, unit: e.target.value})}
                             >
                                {[
                                  ['pcs', 'Pieces'],
                                  ['kg', 'Kilograms'],
                                  ['bundle', 'Bundles'],
                                  ['bunch', 'Bunches'],
                                  ['punnet', 'Punnets'],
                                  ['crate', 'Crates'],
                                  ['pack', 'Packs'],
                                  ['pair', 'Pairs'],
                                  ['set', 'Sets'],
                                  ['box', 'Boxes'],
                                  ['litre', 'Litres'],
                                  ['bottle', 'Bottles'],
                                  ['cup', 'Cups'],
                                  ['pot', 'Pots'],
                                  ['tray', 'Trays'],
                                  ['m', 'Metres'],
                                  ['m²', 'Square metres'],
                                  ['pcs/crate', 'Pieces per crate'],
                                  ['bag', 'Bags'],
                                  ['bucket', 'Buckets'],
                                  ['roll', 'Rolls'],
                                  ['spool', 'Spools'],
                                  ['ream', 'Reams'],
                                  ['job', 'Jobs'],
                                  ['trip', 'Trips'],
                                  ['page', 'Pages'],
                                  ['session', 'Sessions'],
                                  ['day', 'Days'],
                                ].map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                             </select>
                          </div>
                       </div>

                       {formData.stockType === 'finite' && (
                         <div className="space-y-4 animate-reveal">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Quantity in Stock</label>
                            <input 
                              type="number" 
                              required 
                              className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-xl font-bold outline-none focus:border-[#ff6b00]"
                              value={formData.stockQuantity}
                              onChange={e => setFormData({...formData, stockQuantity: e.target.value})}
                            />
                         </div>
                       )}

                       {/* Weight Input Field */}
                       <div className="space-y-4 animate-reveal">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Weight (kg)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="e.g. 0.5"
                            className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-xl font-bold outline-none focus:border-[#ff6b00]"
                            value={formData.weight}
                            onChange={e => setFormData({...formData, weight: e.target.value})}
                          />
                       </div>

                       <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                          <div className="space-y-4 animate-reveal">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Min Weight (kg)</label>
                             <input
                               type="number"
                               step="0.01"
                               min="0"
                               placeholder="e.g. 1"
                               className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-xl font-bold outline-none focus:border-[#ff6b00]"
                               value={formData.minWeight}
                               onChange={e => setFormData({...formData, minWeight: e.target.value})}
                             />
                          </div>
                          <div className="space-y-4 animate-reveal">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Max Weight (kg)</label>
                             <input
                               type="number"
                               step="0.01"
                               min="0"
                               placeholder="e.g. 5"
                               className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-xl font-bold outline-none focus:border-[#ff6b00]"
                               value={formData.maxWeight}
                               onChange={e => setFormData({...formData, maxWeight: e.target.value})}
                             />
                          </div>
                       </div>

                       <div className="pt-6 border-t border-[#e0e0e0]/10 space-y-4">
                          <label className="flex items-center gap-6 cursor-pointer group">
                             <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all ${formData.isMadeInRwanda ? 'bg-[#e05300] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
                                {formData.isMadeInRwanda && <span className="text-sm">✓</span>}
                             </div>
                             <input 
                               type="checkbox" 
                               className="sr-only" 
                               checked={formData.isMadeInRwanda} 
                               onChange={e => setFormData({...formData, isMadeInRwanda: e.target.checked})} 
                             />
                             <div className="space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-widest block text-[#1b1c1c]">Made in Rwanda</span>
                                <span className="text-[9px] text-[#414844] opacity-60">Mark if this product is locally made.</span>
                             </div>
                          </label>
                          <label className="flex items-center gap-6 cursor-pointer group">
                             <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all ${formData.isNegotiable ? 'bg-[#e05300] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
                                {formData.isNegotiable && <span className="text-sm">✓</span>}
                             </div>
                             <input 
                               type="checkbox" 
                               className="sr-only" 
                               checked={formData.isNegotiable} 
                               onChange={e => setFormData({...formData, isNegotiable: e.target.checked})} 
                             />
                             <div className="space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-widest block text-[#1b1c1c]">Price is Negotiable</span>
                                <span className="text-[9px] text-[#414844] opacity-60">Require buyers to chat with you to agree on a price.</span>
                             </div>
                          </label>
                          {formData.isNegotiable && (
                            <div className="grid grid-cols-1 gap-8 rounded-lg border border-[#e0e0e0]/20 bg-white/70 p-5 md:grid-cols-2">
                              <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Min Price (RWF)</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="20000"
                                  className="w-full bg-[#fcf9f8] border border-[#e0e0e0]/20 p-4 text-sm font-bold outline-none focus:border-[#ff6b00]"
                                  value={formData.minPrice}
                                  onChange={e => setFormData({...formData, minPrice: e.target.value})}
                                />
                              </div>
                              <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40">Max Price (RWF)</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="30000"
                                  className="w-full bg-[#fcf9f8] border border-[#e0e0e0]/20 p-4 text-sm font-bold outline-none focus:border-[#ff6b00]"
                                  value={formData.maxPrice}
                                  onChange={e => setFormData({...formData, maxPrice: e.target.value})}
                                />
                              </div>
                            </div>
                          )}
                       </div>
                    </div>
                 </div>

                 {formData.category && (
                   <CatalogAttributeFields
                     category={categoryFor(catalogCategories, formData.category)}
                     attributes={formData.attributes}
                     onAttributesChange={attributes => setFormData({ ...formData, attributes })}
                     variants={formData.variants}
                     onVariantsChange={variants => setFormData({ ...formData, variants })}
                   />
                 )}

                 <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Product Description</label>
                    <textarea 
                      required 
                      rows={6}
                      className="w-full bg-[#fcf9f8] border border-[#e0e0e0]/10 p-8 text-sm outline-none focus:border-[#ff6b00] leading-relaxed"
                      placeholder="Describe your product — materials, dimensions, care instructions, etc."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                 </div>

                 {/* Submit */}
                 <div className="pt-20 border-t-2 border-[#e0e0e0] flex justify-between items-center">
                    <button 
                      type="button" 
                      onClick={() => router.back()}
                      className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 hover:text-[#1b1c1c] transition-colors"
                    >
                      ← Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="rmf-btn-primary px-20 py-6 bg-[#e05300] text-white shadow-[0_30px_60px_-15px_rgba(18,18,18,0.4)] hover:bg-[#ff6b00] transition-all border-none"
                    >
                      {isSubmitting ? (editId ? 'Saving...' : 'Publishing...') : (editId ? 'Save Product' : 'Publish Product')}
                    </button>
                 </div>
              </form>
            ) : (
              <div className="p-12 md:p-20 space-y-10">
                <div className="flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center border-b border-[#e0e0e0] pb-8">
                  <div>
                    <h3 className="text-2xl font-black text-[#1b1c1c]">Bulk Spreadsheet Upload</h3>
                    <p className="text-xs text-[#414844] mt-2 max-w-xl opacity-75">
                      Upload products at scale using our CSV spreadsheet template. Once uploaded, products are automatically approved and listed active.
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
                  <div className="border border-[#edf1ee] rounded-md p-6 bg-[#fcf9f8] space-y-6 animate-reveal">
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

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#e0e0e0]">
                      <button
                        type="button"
                        onClick={() => router.push('/seller/products')}
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 hover:text-[#1b1c1c] transition-colors px-6 py-2.5"
                      >
                        ← Back to Inventory
                      </button>
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
                  <form onSubmit={handleBulkUpload} className="space-y-8">
                    <div className="border-2 border-dashed border-[#b8c7be]/50 rounded-lg p-14 bg-[#f7faf8] text-center relative group hover:border-[#ff6b00] transition duration-300">
                      <input
                        type="file"
                        accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-4">
                        <UploadCloud className="text-[#5f7569] group-hover:text-[#ff6b00] transition duration-300" size={44} />
                        <p className="text-sm font-black uppercase tracking-widest text-[#1b1c1c]">
                          {bulkFile ? bulkFile.name : 'Select or drag your CSV/Excel spreadsheet'}
                        </p>
                        <p className="text-[10px] text-[#414844] tracking-wider opacity-60">
                          {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5 MB'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-10 border-t border-[#e0e0e0] flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 hover:text-[#1b1c1c] transition-colors"
                      >
                        ← Cancel
                      </button>
                      {bulkFile && (
                        <button
                          type="submit"
                          disabled={isBulkUploading}
                          className="rounded-md bg-[#e05300] px-10 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#ff6b00] transition disabled:opacity-50"
                        >
                          {isBulkUploading ? 'Processing...' : 'Upload & Import'}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
         </div>
      </div>
    </Layout>
  );
}

