'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CatalogAttributeFields } from '@/components/catalog/CatalogAttributeFields';
import { useAuth } from '@/context/AuthContext';
import { productApi } from '@/lib/api';
import { CatalogCategory, ProductVariantDraft, categoryFor, fallbackCatalogCategories } from '@/lib/catalog';
import toast from 'react-hot-toast';

type ApiError = { response?: { data?: { message?: string } } };

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.images.length === 0) return toast.error('At least one product photo is required');
    if (!user?.id) return toast.error('Please log in again to continue.');
    
    setIsSubmitting(true);
    try {
      await productApi.post('/products', {
        ...formData,
        categoryId: formData.category,
        price: Number(formData.price),
        stockQuantity: formData.stockType === 'finite' ? Number(formData.stockQuantity) : 999999,
        weight: Number(formData.weight) || 0,
        sellerId: user.id
      });
      toast.success('Product added successfully!');
      router.push('/seller/products');
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || 'Failed to add product. Please try again.');
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
               <div className="w-12 h-px bg-[#1b4332]"></div>
               <p className="text-[11px] font-black text-[#1b4332] uppercase tracking-[0.5em]">Seller Dashboard</p>
            </div>
            <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
               Add New Product
            </h1>
            <p className="text-sm text-[#414844] mt-6 max-w-xl leading-relaxed opacity-70">
               List a new product in your shop. Make sure to include clear photos and an accurate description for better sales.
            </p>
         </div>

         <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#1b4332]"></div>
            
            <form onSubmit={handleSubmit} className="p-12 md:p-20 space-y-16">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  {/* Left Column: Name, Category, Images */}
                  <div className="space-y-10">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Product Name</label>
                        <input 
                          type="text" 
                          required 
                          className="w-full border-b-2 border-[#e0e0e0]/10 p-4 text-2xl font-sans outline-none focus:border-[#1b4332] bg-transparent" 
                          placeholder="e.g. Handwoven Agaseke Basket"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Category</label>
                        <select 
                          required 
                          className="w-full bg-[#fcf9f8] border border-[#e0e0e0]/10 p-5 text-sm font-bold uppercase tracking-widest outline-none focus:border-[#1b4332]"
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                           <option value="">Select a category...</option>
                           {catalogCategories.map(category => (
                             <option key={category.id} value={category.id}>{category.label}</option>
                           ))}
                        </select>
                     </div>

                     <div className="space-y-4 pt-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 text-center block">Product Photos</label>
                        <div className="grid grid-cols-2 gap-6">
                           {formData.images.map((img, i) => (
                             <div key={i} className="aspect-square border border-[#e0e0e0] rounded-lg relative group overflow-hidden">
                                <img src={img} alt={`Product image ${i + 1}`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
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
                          className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-3xl font-sans outline-none focus:border-[#1b4332]"
                          value={formData.price}
                          onChange={e => setFormData({...formData, price: e.target.value})}
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Stock Type</label>
                           <select 
                             className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#1b4332]"
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
                             className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#1b4332]"
                             value={formData.unit}
                             onChange={e => setFormData({...formData, unit: e.target.value})}
                           >
                              <option value="pcs">Pieces</option>
                              <option value="kg">Kilograms</option>
                              <option value="pair">Pairs</option>
                              <option value="set">Set</option>
                           </select>
                        </div>
                     </div>

                     {formData.stockType === 'finite' && (
                       <div className="space-y-4 animate-reveal">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40">Quantity in Stock</label>
                          <input 
                            type="number" 
                            required 
                            className="w-full bg-white border border-[#e0e0e0]/10 p-5 text-xl font-bold outline-none focus:border-[#1b4332]"
                            value={formData.stockQuantity}
                            onChange={e => setFormData({...formData, stockQuantity: e.target.value})}
                          />
                       </div>
                     )}

                     <div className="pt-6 border-t border-[#e0e0e0]/10 space-y-4">
                        <label className="flex items-center gap-6 cursor-pointer group">
                           <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all ${formData.isMadeInRwanda ? 'bg-[#012d1d] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
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
                           <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all ${formData.isNegotiable ? 'bg-[#012d1d] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
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
                    className="w-full bg-[#fcf9f8] border border-[#e0e0e0]/10 p-8 text-sm outline-none focus:border-[#1b4332] leading-relaxed"
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
                    className="rmf-btn-primary px-20 py-6 bg-[#012d1d] text-white shadow-[0_30px_60px_-15px_rgba(18,18,18,0.4)] hover:bg-[#1b4332] transition-all border-none"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish Product'}
                  </button>
               </div>
            </form>
         </div>
      </div>
    </Layout>
  );
}
