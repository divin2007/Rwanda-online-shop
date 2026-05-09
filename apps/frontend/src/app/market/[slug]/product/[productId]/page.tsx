'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { productApi, orderApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import { ImageUpload } from '@/components/ui/ImageUpload';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { user } = useAuth();
  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { addToCart } = useCart();
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [customization, setCustomization] = React.useState('');
  const [referencePhoto, setReferencePhoto] = React.useState('');

  const [isSuccessModalOpen, setIsSuccessModalOpen] = React.useState(false);

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  const handleAddToCart = () => {
    if (product) {
      if (product.attributes?.isCustomizable === 'true' && !customization.trim()) {
        return toast.error('Please provide your customization instructions');
      }
      addToCart(product, customization);
      toast.success(`${product.name} added to cart`);
    }
  };

  const handleRequestQuote = async () => {
    if (!user) return toast.error('Please login to request a quote');
    if (!customization.trim()) return toast.error('Please describe your request');
    
    const loadingToast = toast.loading('Sending quote request to artisan...');
    try {
      await orderApi.post('/orders', {
        buyer: {
          userId: user.id,
          fullName: user.fullName || 'Anonymous',
          phone: user.phone || '0780000000',
          deliveryAddress: { 
            address: 'TBD',
            coordinates: { lat: 0, lng: 0 } // Dummy for initial quote
          }
        },
        seller: {
          sellerId: product.sellerId?._id || product.sellerId,
          userId: product.sellerId?.userId || product.sellerUserId,
          fullName: product.sellerId?.stallName || product.sellerId?.shopDetails?.name || 'Verified Seller',
          stallId: product.stallId || product.sellerId?.stallId || 'N/A',
          marketId: product.marketId?._id || product.marketId
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: 0,
          quantity: 1,
          customization: customization,
          prototypeImage: referencePhoto
        }],
        financials: {
          subtotal: 0,
          deliveryFee: 0,
          platformCommission: 0,
          gatewayFee: 0,
          totalAmount: 0,
          sellerPayout: 0,
          riderPayout: 0
        },
        payment: {
          method: 'QUOTE_PENDING'
        },
        status: 'placed',
        attributes: {
          isQuoteRequest: 'true',
          prototypeImage: referencePhoto
        },
        notes: customization
      });
      
      toast.success('Quote request sent successfully!', { id: loadingToast });
      setCustomization('');
      setReferencePhoto('');
      setIsSuccessModalOpen(true);
      
      // Auto-redirect after a few seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
    } catch (e: any) {
      console.error('Quote Request Error:', e.response?.data || e.message);
      toast.error(e.response?.data?.message || 'Failed to send request. Is the Order Service running?', { id: loadingToast });
    }
  };

  if (loading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!product) return <Layout><div className="p-20 text-center">Product not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Breadcrumb */}
        <nav className="text-sm font-medium text-text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/markets" className="hover:text-primary">Markets</Link>
          <span className="mx-2">/</span>
          <Link href={`/market/${params.slug}`} className="hover:text-primary capitalize">{params.slug.replace(/-/g, ' ')}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Product Images Gallery */}
          <div className="space-y-4">
            <div className="aspect-square bg-background-surface rounded-3xl overflow-hidden border border-border relative group shadow-inner">
              <img 
                src={product.images?.[activeImageIndex] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&q=80&w=800&h=800'} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              />
              {product.images?.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setActiveImageIndex(prev => prev > 0 ? prev - 1 : product.images.length - 1)}
                    className="w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white"
                  >
                    ←
                  </button>
                  <button 
                    onClick={() => setActiveImageIndex(prev => prev < product.images.length - 1 ? prev + 1 : 0)}
                    className="w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {product.images.map((img: string, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeImageIndex === idx ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-heading font-bold text-text-primary mb-2">{product.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col">
                {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? (
                  <span className="text-2xl font-bold text-primary">Price on Quote</span>
                ) : product.promotion ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-status-warning">
                        {product.promotion.promotedPrice.toLocaleString()} RWF
                      </span>
                      <span className="bg-status-warning text-white text-xs font-bold px-2 py-1 rounded-lg animate-pulse">
                        {product.promotion.type === 'percentage' ? `-${product.promotion.discount}%` : `-${product.promotion.discount.toLocaleString()} RWF`} OFF
                      </span>
                    </div>
                    <span className="text-sm text-text-secondary line-through">
                      Original: {product.price.toLocaleString()} RWF
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    {product.price.toLocaleString()} RWF
                  </span>
                )}
              </div>
              <span className="text-text-secondary self-end pb-1">/ {product.unit || 'unit'}</span>
              {product.inStock ? (
                <span className="bg-status-success/10 text-status-success text-xs font-bold px-2 py-1 rounded h-fit self-center">Available</span>
              ) : (
                <span className="bg-status-error/10 text-status-error text-xs font-bold px-2 py-1 rounded h-fit self-center">Out of Stock</span>
              )}
            </div>

            <p className="text-text-secondary mb-6 leading-relaxed">
              {product.description || 'No description available for this product.'}
            </p>

            {/* Customization & Prototype Section */}
            {(product.attributes?.isCustomizable === 'true' || product.attributes?.isCustomizable === true || product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) && (
              <div className="mb-8 p-5 bg-background-surface border-2 border-dashed border-primary/20 rounded-2xl">
                <label className="block text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                  <span>{(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? '📋 Project Brief & Prototype' : '✨ Personalization'}</span>
                </label>
                
                <textarea 
                  className="w-full p-4 border border-border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-primary min-h-[120px] mb-4"
                  placeholder={
                    (product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? 'Describe exactly what you want us to create. Include dimensions, colors, and specific requirements...' :
                    'Enter your customization details here...'
                  }
                  value={customization}
                  onChange={(e) => setCustomization(e.target.value)}
                />

                {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-text-secondary uppercase">Upload Reference Photo / Example</label>
                    <div className="flex items-center gap-4">
                      {referencePhoto ? (
                        <div className="relative w-20 h-20 rounded-lg border border-border overflow-hidden group">
                          <img src={referencePhoto} alt="Ref" className="w-full h-full object-cover" />
                          <button onClick={() => setReferencePhoto('')} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <ImageUpload 
                            service="product" 
                            endpoint="/products/upload-image" 
                            onUploadSuccess={(url) => setReferencePhoto(url)} 
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary">Upload an image of a similar product or a prototype drawing to help the seller quote accurately.</p>
                  </div>
                )}
              </div>
            )}

            {/* Seller Info Card */}
            <div className="bg-background-surface border border-border rounded-xl p-4 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-1">Expert Artisan</p>
                <p className="font-bold text-text-primary">{product.seller?.name || 'Verified Seller'}</p>
                <p className="text-sm text-text-secondary">
                  Stall: {product.stallId || product.sellerId?.stallId || product.sellerId?.shopDetails?.stallId || 'N/A'}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-status-warning font-bold mb-1">
                  ⭐ {product.seller?.rating || 'New'}
                </div>
                <p className="text-xs text-text-secondary">Market: {params.slug.replace(/-/g, ' ')}</p>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex gap-4">
                {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? (
                  <Button size="lg" className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleRequestQuote}>
                    📩 Send Quote Request
                  </Button>
                ) : (
                  <>
                    <Button size="lg" className="flex-1" disabled={!product.inStock} onClick={handleAddToCart}>
                      Add to Cart
                    </Button>
                    <Button size="lg" variant="outline" className="flex-1" onClick={handleAddToCart}>
                      <Link href="/cart" className="w-full block">Buy Now</Link>
                    </Button>
                  </>
                )}
              </div>
              <p className="text-center text-xs text-text-muted mt-4">
                {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) 
                  ? 'No payment required now. The seller will send you an offer with a price.'
                  : 'Delivery calculated at checkout based on your location.'}
              </p>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-20 pt-10 border-t border-border">
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-6">Customer Reviews</h2>
          <div className="bg-background-surface rounded-2xl p-8 text-center text-text-secondary">
            <p>No reviews yet for this product. Be the first to review!</p>
          </div>
        </div>
        {/* Success Modal */}
        {isSuccessModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center scale-in-center animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-status-success/10 text-status-success rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Request Sent!</h2>
              <p className="text-text-secondary mb-8">
                Your quote request for <strong>{product.name}</strong> has been sent to the artisan. They will review your brief and send you a price offer soon.
              </p>
              <div className="space-y-3">
                <Link href="/dashboard" className="block">
                  <Button fullWidth size="lg">Go to My Orders</Button>
                </Link>
                <button 
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Stay on this page
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
