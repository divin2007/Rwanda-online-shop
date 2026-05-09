'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi, sellerApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerPromotionsPage() {
  const { user } = useAuth();
  const { data: promotions, execute: fetchPromotions } = useApi(productApi, 'get', `/promotions?sellerId=${user?.id}`);
  const { data: products, execute: fetchProducts } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: profile, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  
  const [formData, setFormData] = useState({ productId: '', type: 'percentage', discount: '', endDate: '' });

  useEffect(() => {
    if (user?.id) {
      fetchPromotions();
      fetchProducts();
      fetchProfile();
    }
  }, [user?.id, fetchPromotions, fetchProducts, fetchProfile]);

  const selectedProduct = products?.find((p: any) => p._id === formData.productId);
  const calculatedPrice = selectedProduct 
    ? formData.type === 'percentage'
      ? selectedProduct.price * (1 - Number(formData.discount) / 100)
      : selectedProduct.price - Number(formData.discount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedPrice < 100) return toast.error('Promoted price cannot be below 100 RWF');
    
    try {
      await productApi.post('/promotions', {
        ...formData,
        sellerId: user?.id,
        discount: Number(formData.discount),
        promotedPrice: calculatedPrice
      });
      toast.success('Promotion created');
      fetchPromotions();
      setFormData({ productId: '', type: 'percentage', discount: '', endDate: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create promotion');
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
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Earnings</Link>
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${profile?.stallId}`} target="_blank" rel="noreferrer" className="block w-full text-left px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Print QR Code</a>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-8">Manage Promotions</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold mb-4">Create Deal</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Select Product</label>
                  <select required className="w-full p-2 border border-border rounded" value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})}>
                    <option value="">Choose...</option>
                    {products?.map((p:any) => <option key={p._id} value={p._id}>{p.name} ({p.price} RWF)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Type</label>
                  <select className="w-full p-2 border border-border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (RWF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Value</label>
                  <input type="number" required min="1" className="w-full p-2 border border-border rounded" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input type="datetime-local" required className="w-full p-2 border border-border rounded" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
                
                {selectedProduct && formData.discount && (
                  <div className="bg-primary/10 p-3 rounded text-sm text-center">
                    New Price: <span className="font-bold text-lg text-primary">{calculatedPrice} RWF</span>
                  </div>
                )}
                <Button type="submit" fullWidth>Create Promotion</Button>
              </form>
            </Card>

            <Card noPadding className="lg:col-span-2">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-bold">Manage Promotions</h2>
                <span className="text-xs text-text-secondary">{promotions?.length || 0} Total</span>
              </div>
              <div className="p-6">
                {!promotions || promotions.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-4">🏷️</div>
                    <p className="text-text-secondary">No promotions found. Create one to boost your sales!</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {promotions.map((promo: any) => {
                      const now = new Date();
                      const end = new Date(promo.endDate);
                      const start = new Date(promo.startDate || promo.createdAt);
                      const isExpired = end < now;
                      const isFuture = start > now;
                      const isActive = !isExpired && !isFuture && promo.isActive !== false;

                      return (
                        <div key={promo._id} className={`group relative border rounded-2xl p-5 transition-all hover:shadow-md ${isExpired ? 'bg-background-surface opacity-75' : 'bg-white border-border'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-xl bg-background-surface flex items-center justify-center text-2xl">
                                {promo.product?.images?.[0] ? (
                                  <img src={promo.product.images[0]} className="w-full h-full object-cover rounded-xl" alt="" />
                                ) : '🏷️'}
                              </div>
                              <div>
                                <h3 className="font-bold text-text-primary group-hover:text-primary transition-colors">{promo.product?.name || 'Unknown Product'}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  {isActive && <span className="flex h-2 w-2 rounded-full bg-status-success animate-pulse"></span>}
                                  <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-status-success' : isExpired ? 'text-text-secondary' : 'text-status-warning'}`}>
                                    {isActive ? 'Active' : isExpired ? 'Expired' : 'Starts Soon'}
                                  </span>
                                  <span className="text-xs text-text-muted">•</span>
                                  <span className="text-xs text-text-secondary">Ends {end.toLocaleDateString()} at {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-text-secondary line-through">{promo.product?.price?.toLocaleString()} RWF</span>
                                <span className="bg-status-warning/10 text-status-warning text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                  {promo.type === 'percentage' ? `${promo.discount}% OFF` : `-${promo.discount.toLocaleString()} RWF`}
                                </span>
                              </div>
                              <p className="text-xl font-black text-primary">{promo.promotedPrice?.toLocaleString()} RWF</p>
                              
                              <button 
                                onClick={() => handleDelete(promo._id)} 
                                className={`mt-3 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isExpired ? 'border-border text-text-muted cursor-not-allowed' : 'border-status-error/20 text-status-error hover:bg-status-error hover:text-white'}`}
                                disabled={isExpired}
                              >
                                {isExpired ? 'Ended' : 'End Promotion'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </Layout>
  );
}
