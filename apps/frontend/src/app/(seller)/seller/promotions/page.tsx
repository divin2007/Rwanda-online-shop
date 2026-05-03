'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerPromotionsPage() {
  const { user } = useAuth();
  const { data: promotions, execute: fetchPromotions } = useApi(productApi, 'get', `/promotions?sellerId=${user?.id}`);
  const { data: products } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  
  const [formData, setFormData] = useState({ productId: '', type: 'percentage', discount: '', endDate: '' });

  useEffect(() => {
    if (user?.id) fetchPromotions();
  }, [user?.id, fetchPromotions]);

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
        discount: Number(formData.discount),
        promotedPrice: calculatedPrice
      });
      toast.success('Promotion created');
      fetchPromotions();
      setFormData({ productId: '', type: 'percentage', discount: '', endDate: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create promotion');
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
              <div className="p-6 border-b border-border"><h2 className="text-lg font-bold">Active Promotions</h2></div>
              <div className="p-6">
                {!promotions || promotions.length === 0 ? (
                  <p className="text-text-secondary text-center">No active promotions.</p>
                ) : (
                  <div className="space-y-4">
                    {promotions.map((promo: any) => (
                      <div key={promo._id} className="border border-border p-4 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-bold">{promo.product?.name || 'Product'}</p>
                          <p className="text-sm text-text-secondary">Ends: {new Date(promo.endDate).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{promo.promotedPrice} RWF</p>
                          <span className="bg-status-warning text-white text-xs px-2 py-1 rounded">-{promo.discount}{promo.type==='percentage'?'%':'RWF'}</span>
                        </div>
                        <button onClick={() => handleDelete(promo._id)} className="text-status-error text-sm font-medium hover:underline">End</button>
                      </div>
                    ))}
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
