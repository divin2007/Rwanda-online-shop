'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi, sellerApi } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import toast from 'react-hot-toast';

export default function SellerProductsPage() {
  const { user } = useAuth();
  const { data: products, execute: fetchProducts, loading: productsLoading } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: profile, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: '', 
    price: '', 
    unit: '', 
    stockType: 'finite',
    stockQuantity: '', 
    weight: '', 
    isMadeInRwanda: true,
    images: [] as string[],
    attributes: {} as Record<string, string>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProducts();
      fetchProfile();
    }
  }, [user?.id, fetchProducts, fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.images.length === 0) return toast.error('At least one product image is required');
    
    setIsSubmitting(true);
    try {
      await productApi.post('/products', {
        ...formData,
        price: Number(formData.price),
        stockQuantity: formData.stockType === 'finite' ? Number(formData.stockQuantity) : 999999,
        weight: Number(formData.weight) || 0,
        sellerId: user?.id
      });
      toast.success('Product added successfully');
      setIsModalOpen(false);
      setFormData({ name: '', description: '', category: '', price: '', unit: '', stockType: 'finite', stockQuantity: '', weight: '', isMadeInRwanda: true, images: [], attributes: {} });
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save product. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product? This cannot be undone.')) {
      try {
        await productApi.delete(`/products/${id}`);
        toast.success('Product deleted');
        fetchProducts();
      } catch (e) {
        toast.error('Delete failed');
      }
    }
  };

  return (
    <Layout>
      <div className="animate-reveal space-y-16 pb-20">
        {/* Tactical Header */}
        <div className="flex justify-between items-end border-b-2 border-[#121212] pb-10">
          <div>
            <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-3 italic">Inventory Management</p>
            <h1 className="text-6xl font-serif text-[#121212] italic tracking-tighter">My Products</h1>
            <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mt-2 opacity-60">{products?.length || 0} Products Listed</p>
          </div>
          <Link 
            href="/seller/products/new"
            className="bg-[#121212] text-white text-[10px] px-12 py-5 font-bold uppercase tracking-[0.3em] hover:bg-[#A34D15] transition-all shadow-xl flex items-center gap-3"
          >
            <span className="text-lg">+</span> Add New Product
          </Link>
        </div>

        {/* Collection Matrix */}
        <div className="bg-white border-2 border-[#121212] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#121212] text-white">
                <th className="p-8 text-[9px] font-black uppercase tracking-[0.4em]">Product</th>
                <th className="p-8 text-[9px] font-black uppercase tracking-[0.4em]">Price</th>
                <th className="p-8 text-[9px] font-black uppercase tracking-[0.4em]">Availability</th>
                <th className="p-8 text-[9px] font-black uppercase tracking-[0.4em]">Status</th>
                <th className="p-8 text-[9px] font-black uppercase tracking-[0.4em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE4]">
              {productsLoading ? (
                 [1,2,3].map(i => (
                   <tr key={i} className="animate-pulse">
                     <td colSpan={5} className="p-12 h-20 bg-[#F8F6F1]/50 border-b border-[#E5E1D8]"></td>
                   </tr>
                 ))
              ) : products?.length > 0 ? products.map((p: any) => (
                <tr key={p._id} className="hover:bg-[#F9F7F2] transition-colors group">
                  <td className="p-8 flex items-center gap-6">
                    <div className="w-20 h-20 bg-[#F8F6F1] border border-[#E5E1D8] overflow-hidden flex-shrink-0">
                       <img src={p.images?.[0] || 'https://images.unsplash.com/photo-1590073844006-33379778ae09'} alt={p.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                    </div>
                    <div>
                      <h4 className="text-xl font-serif text-[#121212] italic tracking-tighter group-hover:text-[#A34D15] transition-colors">{p.name}</h4>
                      <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-40 mt-1">{p.category}</p>
                    </div>
                  </td>
                  <td className="p-8 font-serif text-lg text-[#121212]">
                    {p.price?.toLocaleString()} <span className="text-[9px] uppercase not-italic opacity-40 ml-1">RWF</span>
                  </td>
                  <td className="p-8">
                    <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">
                       {p.stockType === 'infinite' ? '∞ Unlimited' : `${p.stockQuantity} ${p.unit}`}
                    </p>
                    <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest mt-1 opacity-50 italic">Stock Type: {p.stockType}</p>
                  </td>
                  <td className="p-8">
                    <span className={`text-[8px] font-black px-4 py-1 uppercase tracking-widest border-2 ${p.inStock ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}>
                      {p.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="p-8 text-right">
                    <div className="flex justify-end gap-6">
                      <button className="text-[9px] font-black uppercase tracking-widest text-[#121212] hover:text-[#A34D15] transition-colors">Edit</button>
                      <button onClick={() => handleDelete(p._id)} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-32 text-center">
                     <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.5em] italic opacity-40">No products listed yet</p>
                     <Link href="/seller/products/new" className="mt-8 text-[11px] font-black text-[#A34D15] uppercase tracking-widest hover:underline">+ Add Your First Product</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tactical Guidance */}
        <div className="bg-[#121212] text-white p-12 relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 p-10 opacity-5">
              <div className="text-[80px] font-serif leading-none italic select-none">PRODUCT</div>
           </div>
           <div className="relative z-10 max-w-3xl">
              <h3 className="text-2xl font-serif italic text-[#A34D15] mb-6">Commercial Standards</h3>
              <p className="text-sm italic leading-relaxed text-white/70">
                 Keep your product photos clear and your stock updated. Accurate descriptions and high-quality images help buyers find your products and increase sales. "Made in Rwanda" products get priority visibility.
              </p>
           </div>
        </div>
      </div>
    </Layout>
  );
}
