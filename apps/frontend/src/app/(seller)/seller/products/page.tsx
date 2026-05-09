'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi, sellerApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerProductsPage() {
  const { user } = useAuth();
  const { data: products, execute: fetchProducts } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: profile, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: '', 
    price: '', 
    unit: '', 
    stockQuantity: '', 
    weight: '', 
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
    if (formData.images.length === 0) return toast.error('At least 1 product photo is required');
    if (formData.attributes.isQuoteRequired !== 'true' && Number(formData.price) < 100) {
      return toast.error('Price must be at least 100 RWF');
    }

    setIsSubmitting(true);
    try {
      await productApi.post('/products', {
        ...formData,
        price: Number(formData.price),
        stockQuantity: Number(formData.stockQuantity),
        weight: Number(formData.weight),
        sellerId: user?.id
      });
      toast.success('Product created successfully!');
      setIsModalOpen(false);
      setFormData({ name: '', description: '', category: '', price: '', unit: '', stockQuantity: '', weight: '', images: [], attributes: {} });
      fetchProducts();
    } catch (error: any) {
      console.error('Full Error Response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
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
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Simplified Sidebar for example */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Earnings</Link>
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${profile?.stallId}`} target="_blank" rel="noreferrer" className="block w-full text-left px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Print QR Code</a>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-heading font-bold text-text-primary">My Products</h1>
            <Button onClick={() => setIsModalOpen(true)}>+ Add Product</Button>
          </div>

          <Card noPadding>
            <table className="w-full text-left">
              <thead className="bg-background-surface text-text-secondary text-sm">
                <tr>
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Stock</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!products || products.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-text-secondary">No products yet. Add your first product to start selling!</td></tr>
                ) : (
                  products.map((p: any) => (
                    <tr key={p._id} className="hover:bg-background-surface/50">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-border overflow-hidden">
                          {p.images?.[0] && <img src={p.images[0]} alt={p.name} loading="eager" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </td>
                      <td className="p-4 font-bold">{p.price.toLocaleString()} RWF</td>
                      <td className="p-4">{p.stockQuantity} {p.unit}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${p.inStock ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}>
                          {p.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-primary hover:underline text-sm font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(p._id)} className="text-status-error hover:underline text-sm font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          {/* Add Product Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                <h2 className="text-xl font-bold mb-6">Add New Product</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Product Name</label>
                      <input type="text" required className="w-full p-2 border border-border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select 
                        required 
                        className="w-full p-2 border border-border rounded bg-background-surface" 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        <option value="grocery">Grocery & Fresh Food</option>
                        <option value="bakery">Bakery & Custom Cakes</option>
                        <option value="fashion">Fashion & Accessories</option>
                        <option value="custom_tailoring">Custom Tailoring (Made-to-Measure)</option>
                        <option value="electronics">Electronics & Tech</option>
                        <option value="home">Home & Kitchen</option>
                        <option value="handicrafts">Handicrafts (Made in Rwanda)</option>
                        <option value="gifts">Gifts & Flowers</option>
                        <option value="prepared_meals">Prepared Meals (Hot Food)</option>
                        <option value="beauty">Health & Beauty</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <input 
                      type="checkbox" 
                      id="isCustomizable"
                      checked={formData.attributes.isCustomizable === 'true'} 
                      onChange={e => setFormData({...formData, attributes: {...formData.attributes, isCustomizable: e.target.checked ? 'true' : 'false'}})}
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                    <label htmlFor="isCustomizable" className="text-sm font-bold text-primary cursor-pointer">
                      ✨ Enable Customer Customization (e.g. Cake Messages, Measurements)
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Short Description</label>
                    <textarea required className="w-full p-2 border border-border rounded" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe your product..."></textarea>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Price (RWF)</label>
                      <input 
                        type="number" 
                        required={formData.attributes.isQuoteRequired !== 'true'} 
                        disabled={formData.attributes.isQuoteRequired === 'true'}
                        min="100" 
                        className={`w-full p-2 border border-border rounded ${formData.attributes.isQuoteRequired === 'true' ? 'bg-background-surface opacity-50' : ''}`}
                        value={formData.price} 
                        onChange={e => setFormData({...formData, price: e.target.value})} 
                        placeholder={formData.attributes.isQuoteRequired === 'true' ? 'Defined per quote' : 'Enter price'}
                      />
                    </div>
                    <div className="col-span-2 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer p-2 bg-amber-50 border border-amber-200 rounded-lg w-full">
                        <input 
                          type="checkbox" 
                          checked={formData.attributes.isQuoteRequired === 'true'} 
                          onChange={e => setFormData({...formData, attributes: {...formData.attributes, isQuoteRequired: e.target.checked ? 'true' : 'false'}, price: e.target.checked ? '' : formData.price})}
                        />
                        <span className="text-xs font-bold text-amber-700">📜 Price on Quote (For custom prototypes/designs)</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Unit</label>
                      <select 
                        required 
                        className="w-full p-2 border border-border rounded bg-background-surface" 
                        value={formData.unit} 
                        onChange={e => setFormData({...formData, unit: e.target.value})}
                      >
                        <option value="">Select Unit</option>
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="liter">Liters (L)</option>
                        <option value="bundle">Bundle/Bunch</option>
                        <option value="pair">Pair</option>
                        <option value="box">Box</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Available Stock</label>
                      <input type="number" required min="1" className="w-full p-2 border border-border rounded" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: e.target.value})} />
                    </div>
                  </div>

                  {/* Smart Attributes for specific categories */}
                  {['grocery', 'fashion', 'electronics'].includes(formData.category) && (
                    <div className="p-4 bg-background-surface rounded-lg border border-border">
                      <label className="block text-xs font-bold mb-3 text-text-secondary uppercase tracking-widest">Additional Details (Optional)</label>
                      <div className="grid grid-cols-2 gap-4">
                        {formData.category === 'grocery' && (
                          <>
                            <input type="number" step="0.1" className="p-2 border border-border rounded text-sm" placeholder="Weight (kg)" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Expiry/Storage" value={formData.attributes.storage || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, storage: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'bakery' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Flavors (e.g. Vanilla, Choco)" value={formData.attributes.flavors || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, flavors: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Size Options (e.g. 1kg, 2kg)" value={formData.attributes.sizes || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, sizes: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'fashion' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Size (e.g. M, L, 42)" value={formData.attributes.size || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, size: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Color" value={formData.attributes.color || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, color: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'custom_tailoring' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Fabric Types" value={formData.attributes.fabrics || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, fabrics: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Processing Time" value={formData.attributes.time || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, time: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'electronics' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Brand" value={formData.attributes.brand || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, brand: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Warranty Info" value={formData.attributes.warranty || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, warranty: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'prepared_meals' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Serving Size" value={formData.attributes.servings || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, servings: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Spice Level" value={formData.attributes.spice || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, spice: e.target.value}})} />
                          </>
                        )}
                        {formData.category === 'gifts' && (
                          <>
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Includes (e.g. Card, Wrap)" value={formData.attributes.includes || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, includes: e.target.value}})} />
                            <input type="text" className="p-2 border border-border rounded text-sm" placeholder="Theme" value={formData.attributes.theme || ''} onChange={e => setFormData({...formData, attributes: {...formData.attributes, theme: e.target.value}})} />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Product Images (Min 1, Max 5)</label>
                    <div className="flex gap-4 mb-2 overflow-x-auto pb-2">
                      {formData.images.map((img, i) => (
                        <div key={i} className="w-24 h-24 flex-shrink-0 border border-border rounded relative">
                          <img src={img} alt="" className="w-full h-full object-cover rounded" />
                          <button type="button" onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)})} className="absolute -top-2 -right-2 bg-status-error text-white rounded-full w-6 h-6 text-xs">x</button>
                        </div>
                      ))}
                    </div>
                    {formData.images.length < 5 && (
                      <ImageUpload service="product" endpoint="/products/upload-image" onUploadSuccess={url => setFormData({...formData, images: [...formData.images, url]})} />
                    )}
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-border">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || formData.images.length === 0}>
                      {isSubmitting ? 'Saving...' : 'Save Product'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
