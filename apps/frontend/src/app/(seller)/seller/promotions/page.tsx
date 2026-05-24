'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import toast from 'react-hot-toast';

export default function SellerPromotionsPage() {
  const { user } = useAuth();
  const { data: promotions, execute: fetchPromotions, loading: promoLoading } = useApi(productApi, 'get', `/promotions?sellerId=${user?.id}`);
  const { data: products, execute: fetchProducts } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  
  const [formData, setFormData] = useState({ productId: '', variantSku: '', type: 'percentage', discount: '', endDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchPromotions();
      fetchProducts();
    }
  }, [user?.id, fetchPromotions, fetchProducts]);

  const selectedProduct = products?.find((p: any) => p._id === formData.productId);

  const getVariantBaselinePrice = (product: any, variantSku?: string | null) => {
    const productPrice = Number(product?.price || 0);
    if (!variantSku || !Array.isArray(product?.variants)) return productPrice;
    const variant = product.variants.find((v: any) => v.sku === variantSku || v.id === variantSku);
    return productPrice + Number(variant?.price || 0);
  };

  const baselinePrice = getVariantBaselinePrice(selectedProduct, formData.variantSku);

  const calculatedPrice = baselinePrice
    ? formData.type === 'percentage'
      ? baselinePrice * (1 - Number(formData.discount) / 100)
      : baselinePrice - Number(formData.discount)
    : 0;
  const sortedPromotions = React.useMemo(() => {
    const list = Array.isArray(promotions) ? [...promotions] : [];
    return list.sort((left: any, right: any) => {
      const leftBase = getVariantBaselinePrice(left.product, left.variantSku);
      const rightBase = getVariantBaselinePrice(right.product, right.variantSku);
      const leftPercent = left.type === 'percentage' ? Number(left.discount || 0) : leftBase > 0 ? (Number(left.discount || 0) / leftBase) * 100 : 0;
      const rightPercent = right.type === 'percentage' ? Number(right.discount || 0) : rightBase > 0 ? (Number(right.discount || 0) / rightBase) * 100 : 0;
      return rightPercent - leftPercent;
    });
  }, [promotions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedPrice < 100) return toast.error('Promoted price cannot be below 100 RWF');
    
    setIsSubmitting(true);
    try {
      await productApi.post('/promotions', {
        ...formData,
        variantSku: formData.variantSku || null,
        sellerId: user?.id,
        discount: Number(formData.discount),
        promotedPrice: calculatedPrice
      });
      toast.success('Promotion activated successfully');
      fetchPromotions();
      setFormData({ productId: '', variantSku: '', type: 'percentage', discount: '', endDate: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create promotion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await productApi.delete(`/promotions/${id}`);
      toast.success('Promotion ended');
      fetchPromotions();
    } catch (e) {
      toast.error('Failed to end promotion');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto animate-reveal space-y-8 pb-20">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#e0e0e0] pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-px bg-[#ffedd5]" />
               <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.22em]">Discounts & Sales</p>
            </div>
            <h1 className="text-4xl md:text-5xl font-sans text-[#1b1c1c] tracking-normal leading-none">Promotions</h1>
            <p className="text-[10px] font-bold text-[#414844] uppercase tracking-widest mt-4 opacity-70">
              {promotions?.length || 0} Active Promotions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* ── Left: Create Promotion Form ── */}
           <div className="lg:col-span-1">
              <div className="bg-white border border-[#e0e0e0] p-5 md:p-6 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-[#e05300]" />
                 <div className="mb-8">
                    <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.18em] mb-2">Grow Sales</p>
                    <h3 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">New Deal</h3>
                 </div>

                 <form onSubmit={handleSubmit} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Select Product</label>
                        <select required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] transition-colors" value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value, variantSku: ''})}>
                           <option value="">Choose an item...</option>
                           {products?.map((p:any) => <option key={p._id} value={p._id}>{p.name} ({p.price} RWF)</option>)}
                        </select>
                     </div>

                     {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                        <div className="space-y-2 animate-reveal">
                           <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Select Variant (Optional)</label>
                           <select className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] transition-colors" value={formData.variantSku} onChange={e => setFormData({...formData, variantSku: e.target.value})}>
                              <option value="">Apply to all variants (Whole Product)</option>
                              {selectedProduct.variants.map((v: any, index: number) => {
                                 const value = v.sku || v.id || `${index}`;
                                 const variantPrice = getVariantBaselinePrice(selectedProduct, value);
                                 return (
                                 <option key={`${value}-${index}`} value={value}>
                                    {v.title} ({variantPrice ? `${variantPrice} RWF` : `${selectedProduct.price} RWF`})
                                 </option>
                                 );
                              })}
                           </select>
                        </div>
                     )}

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Discount Type</label>
                          <select className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] transition-colors" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed_amount">Fixed Amount</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Value</label>
                          <input type="number" required placeholder="e.g. 10" className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] transition-colors" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">End Date</label>
                       <input type="datetime-local" required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] transition-colors" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                    </div>

                    {selectedProduct && formData.discount && (
                      <div className="p-6 bg-[#fcf9f8] border border-[#e0e0e0] text-center mt-6">
                         <p className="text-[9px] font-black uppercase tracking-widest text-[#414844] mb-2">New Sale Price</p>
                         <p className="text-3xl font-sans tracking-normal text-[#ff6b00]">{calculatedPrice?.toLocaleString()} RWF</p>
                      </div>
                    )}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#e05300] text-white mt-8 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-[#e05300] transition-all disabled:opacity-50">
                       {isSubmitting ? 'Activating...' : 'Create Promotion'}
                    </button>
                 </form>
              </div>
           </div>

           {/* ── Right: Active Promotions List ── */}
           <div className="lg:col-span-2 space-y-8">
              <div className="flex justify-between items-end border-b border-[#e0e0e0] pb-4">
                 <h3 className="text-2xl font-sans text-[#1b1c1c]">Active Deals</h3>
                 <span className="text-[10px] font-black uppercase tracking-widest text-[#414844]">{promotions?.length || 0} Running</span>
              </div>

              <div className="space-y-6">
                 {promoLoading ? (
                    <div className="h-32 bg-[#fcf9f8] border border-[#e0e0e0] animate-pulse"></div>
                 ) : sortedPromotions.length > 0 ? sortedPromotions.map((promo: any) => (
                    <div key={promo._id} className="bg-white border border-[#e0e0e0] p-6 flex flex-col md:flex-row justify-between items-start md:items-center group hover:border-[#ff6b00] transition-all shadow-sm">
                       
                       <div className="flex items-center gap-6 mb-4 md:mb-0">
                          <div className="w-20 h-20 bg-[#fcf9f8] border border-[#e0e0e0] overflow-hidden flex-shrink-0 p-1">
                             {promo.product?.images?.[0] ? (
                               <img src={resolveUploadUrl(promo.product.images[0], 'product')} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="" />
                             ) : (
                               <div className="flex h-full w-full items-center justify-center text-[9px] font-black uppercase tracking-widest text-[#414844]">
                                 Deal
                               </div>
                             )}
                          </div>
                          <div>
                             <h4 className="text-xl font-sans tracking-normal text-[#1b1c1c] mb-2 line-clamp-1">
                                 {promo.product?.name || 'Product'}
                                 {promo.variantSku && (
                                    <span className="ml-2 inline-flex items-center rounded bg-[#ffe5d9] px-2 py-0.5 text-[9px] font-black text-[#e05300] uppercase tracking-wider">
                                       Variant: {promo.variantSku}
                                    </span>
                                 )}
                              </h4>
                             <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black bg-[#e05300] text-white px-2 py-1 uppercase tracking-widest">
                                   -{promo.type === 'percentage' ? `${promo.discount}%` : `${promo.discount} RWF`}
                                </span>
                                <span className="text-[9px] font-medium text-[#414844] uppercase tracking-widest">
                                   Ends: {new Date(promo.endDate).toLocaleDateString()}
                                </span>
                             </div>
                          </div>
                       </div>

                       <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 border-[#e0e0e0] pt-4 md:pt-0 gap-4">
                          <div className="text-left md:text-right">
                             <p className="text-[10px] text-[#414844] line-through uppercase tracking-widest opacity-60 mb-1">{getVariantBaselinePrice(promo.product, promo.variantSku)?.toLocaleString()} RWF</p>
                             <p className="text-2xl font-sans tracking-normal text-[#ff6b00]">{promo.promotedPrice?.toLocaleString()} RWF</p>
                          </div>
                          <button onClick={() => handleDelete(promo._id)} className="text-[9px] font-black uppercase tracking-widest text-[#405046] hover:text-[#e05300] transition-colors border border-[#dfe7e2] hover:border-[#ff6b00] px-4 py-2 bg-[#f7faf8]">End Deal</button>
                       </div>
                    </div>
                 )) : (
                    <div className="border-2 border-dashed border-[#e0e0e0] bg-[#fcf9f8] py-24 text-center">
                       <div className="text-4xl mb-4 opacity-50">🏷️</div>
                       <p className="text-lg font-sans text-[#1b1c1c] mb-1">No active promotions</p>
                       <p className="text-[10px] font-medium text-[#414844] uppercase tracking-widest">Create a deal to boost your sales</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
