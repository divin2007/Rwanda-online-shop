'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerPromotionsPage() {
  const { user } = useAuth();
  const { data: promotions, execute: fetchPromotions, loading: promoLoading } = useApi(productApi, 'get', `/promotions?sellerId=${user?.id}`);
  const { data: products, execute: fetchProducts } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  
  const [formData, setFormData] = useState({ productId: '', type: 'percentage', discount: '', endDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchPromotions();
      fetchProducts();
    }
  }, [user?.id, fetchPromotions, fetchProducts]);

  const selectedProduct = products?.find((p: any) => p._id === formData.productId);
  const calculatedPrice = selectedProduct 
    ? formData.type === 'percentage'
      ? selectedProduct.price * (1 - Number(formData.discount) / 100)
      : selectedProduct.price - Number(formData.discount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedPrice < 100) return toast.error('Promoted price cannot be below 100 RWF');
    
    setIsSubmitting(true);
    try {
      await productApi.post('/promotions', {
        ...formData,
        sellerId: user?.id,
        discount: Number(formData.discount),
        promotedPrice: calculatedPrice
      });
      toast.success('Promotion synchronized');
      fetchPromotions();
      setFormData({ productId: '', type: 'percentage', discount: '', endDate: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initialize promotion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await productApi.delete(`/promotions/${id}`);
      toast.success('Promotion terminated');
      fetchPromotions();
    } catch (e) {
      toast.error('Termination failed');
    }
  };

  return (
    <Layout>
      <div className="animate-reveal space-y-16 pb-20">
        {/* Tactical Header */}
        <div className="flex justify-between items-end border-b-2 border-[#121212] pb-10">
          <div>
            <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-3 italic">Commercial Incentives</p>
            <h1 className="text-6xl font-serif text-[#121212] italic tracking-tighter">Market Promotions</h1>
            <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mt-2 opacity-60">Authorized {promotions?.length || 0} Campaigns Active</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
           {/* Left: Creator Portal */}
           <div className="lg:col-span-1">
              <div className="bg-white border-2 border-[#121212] p-12 shadow-2xl space-y-10">
                 <div>
                    <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em] mb-4">Registry</p>
                    <h3 className="text-3xl font-serif italic tracking-tighter text-[#121212]">New Campaign</h3>
                 </div>

                 <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Target Artifact</label>
                       <select required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-5 text-sm italic outline-none focus:border-[#A34D15]" value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})}>
                          <option value="">Select Asset...</option>
                          {products?.map((p:any) => <option key={p._id} value={p._id}>{p.name} ({p.price} RWF)</option>)}
                       </select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Incentive Type</label>
                          <select className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-5 text-sm italic outline-none focus:border-[#A34D15]" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed_amount">Fixed Amount</option>
                          </select>
                       </div>
                       <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Value</label>
                          <input type="number" required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-5 text-sm italic outline-none focus:border-[#A34D15]" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} />
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Expiration Date</label>
                       <input type="datetime-local" required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-5 text-sm italic outline-none focus:border-[#A34D15]" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                    </div>

                    {selectedProduct && formData.discount && (
                      <div className="p-6 bg-[#121212] text-white text-center">
                         <p className="text-[9px] font-black uppercase tracking-widest text-[#A34D15] mb-2">Adjusted Valuation</p>
                         <p className="text-3xl font-serif italic tracking-tighter">{calculatedPrice?.toLocaleString()} RWF</p>
                      </div>
                    )}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#121212] text-white py-6 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all shadow-xl">
                       {isSubmitting ? 'Synchronizing...' : 'Initialize Campaign'}
                    </button>
                 </form>
              </div>
           </div>

           {/* Right: Active Matrix */}
           <div className="lg:col-span-2 space-y-10">
              <div className="flex justify-between items-end border-b border-[#E5E1D8] pb-6">
                 <h3 className="text-2xl font-serif italic text-[#121212]">Operational Campaigns</h3>
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{promotions?.length || 0} Live</span>
              </div>

              <div className="grid grid-cols-1 gap-8">
                 {promoLoading ? (
                    <div className="h-40 bg-[#F2F0EB] animate-pulse border-2 border-dashed border-[#E5E1D8]"></div>
                 ) : promotions?.length > 0 ? promotions.map((promo: any) => (
                    <div key={promo._id} className="bg-white border-2 border-[#121212] p-8 flex flex-col md:flex-row justify-between items-center group relative overflow-hidden">
                       <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-[#F8F6F1] border border-[#E5E1D8] overflow-hidden flex-shrink-0">
                             <img src={promo.product?.images?.[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
                          </div>
                          <div>
                             <h4 className="text-2xl font-serif italic tracking-tighter text-[#121212]">{promo.product?.name || 'Institutional Asset'}</h4>
                             <div className="flex items-center gap-4 mt-2">
                                <span className="text-[8px] font-black bg-[#A34D15] text-white px-3 py-1 uppercase tracking-tighter">
                                   -{promo.type === 'percentage' ? `${promo.discount}%` : `${promo.discount} RWF`}
                                </span>
                                <span className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest opacity-50">
                                   Expires: {new Date(promo.endDate).toLocaleDateString()}
                                </span>
                             </div>
                          </div>
                       </div>

                       <div className="text-right flex flex-col items-end gap-4">
                          <div className="text-right">
                             <p className="text-[9px] text-[#6B665E] line-through uppercase tracking-widest opacity-40">{promo.product?.price?.toLocaleString()} RWF</p>
                             <p className="text-3xl font-serif italic tracking-tighter text-[#121212]">{promo.promotedPrice?.toLocaleString()} RWF</p>
                          </div>
                          <button onClick={() => handleDelete(promo._id)} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline">Terminate Deal</button>
                       </div>
                    </div>
                 )) : (
                    <div className="border-4 border-dashed border-[#F0EDE4] bg-[#F9F7F2]/50 py-32 text-center">
                       <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.5em] italic opacity-40">No active incentives synchronized</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
