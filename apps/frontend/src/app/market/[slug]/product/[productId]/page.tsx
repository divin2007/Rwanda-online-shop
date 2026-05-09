'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { productApi, orderApi, reviewApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import { ImageUpload } from '@/components/ui/ImageUpload';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { user } = useAuth();
  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { data: reviews, execute: fetchReviews } = useApi(reviewApi, 'get', `/reviews/target/product/${params.productId}`);
  const [sellerReviews, setSellerReviews] = React.useState<any[]>([]);
  const { addToCart } = useCart();
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [customization, setCustomization] = React.useState('');
  const [referencePhoto, setReferencePhoto] = React.useState('');

  const [isSuccessModalOpen, setIsSuccessModalOpen] = React.useState(false);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
  }, [params.productId, fetchProduct, fetchReviews]);

  useEffect(() => {
    if (product?.sellerId) {
      const sId = product.sellerId._id || product.sellerId;
      reviewApi.get(`/reviews/target/seller/${sId}`).then(res => setSellerReviews(res.data?.data || []));
    }
  }, [product?.sellerId]);

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
    if (!user) {
      toast.error('Please login to request a quote');
      window.location.href = '/login?redirect=' + window.location.pathname;
      return;
    }
    
    if (!customization.trim()) return toast.error('Please describe your request');
    
    const loadingToast = toast.loading('Sending quote request to artisan...');
    try {
      // Robustly extract IDs ensuring they are strings
      const sellerId = (product.sellerId?._id || product.sellerId || '').toString();
      const sellerUserId = (product.sellerId?.userId || product.sellerUserId || '').toString();
      const marketId = (product.marketId?._id || product.marketId || '').toString();
      
      if (!sellerId || !sellerUserId) {
        throw new Error('Seller information is missing. Please contact support.');
      }

      const payload = {
        buyer: {
          userId: user.id,
          fullName: user.fullName || user.username || 'Valued Customer',
          phone: user.phone || '0780000000',
          deliveryAddress: { 
            address: 'TBD (Quote Phase)',
            coordinates: { lat: -1.9441, lng: 30.0619 } 
          }
        },
        seller: {
          sellerId,
          userId: sellerUserId,
          fullName: product.sellerId?.stallName || product.seller?.name || 'Verified Seller',
          stallId: (product.stallId || product.sellerId?.stallId || 'N/A').toString(),
          marketId
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
      };

      await orderApi.post('/orders', payload);
      
      toast.success('Quote request sent successfully!', { id: loadingToast });
      setCustomization('');
      setReferencePhoto('');
      setIsSuccessModalOpen(true);
      
    } catch (e: any) {
      console.error('Quote Request Error Details:', e.response?.data || e.message);
      const errorMsg = e.response?.data?.message || e.message || 'Failed to send request.';
      toast.error(errorMsg, { id: loadingToast });
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
                {(
                  product.attributes?.isQuoteRequired === 'true' || 
                  product.attributes?.isQuoteRequired === true || 
                  product.attributes?.isCustomizable === 'true' || 
                  product.attributes?.isCustomizable === true ||
                  product.category === 'bakery'
                ) ? (
                  <span className="text-2xl font-bold text-primary">Price on Quote (Negotiable)</span>
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
              <div className="mb-8 p-6 bg-background-surface border-2 border-dashed border-primary/30 rounded-3xl shadow-sm">
                <label className="block text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="text-xl">
                    {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? '📋 Project Brief & Specifications' : '✨ Customization Details'}
                  </span>
                </label>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
                      {product.category === 'bakery' ? 'Cake Message & Flavor Preferences' : 'Description of your custom request'}
                    </label>
                    <textarea 
                      className="w-full p-4 border border-border rounded-2xl bg-white text-base outline-none focus:ring-2 focus:ring-primary min-h-[140px] transition-all shadow-inner"
                      placeholder={
                        (product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? 'Describe exactly what you want us to create. Include dimensions, colors, and any specific messages...' :
                        'Enter your personalization details or messages here...'
                      }
                      value={customization}
                      onChange={(e) => setCustomization(e.target.value)}
                    />
                  </div>

                  {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) && (
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-3 flex items-center gap-2">
                        🖼️ Reference Photo / Example
                      </label>
                      <div className="flex flex-col gap-4">
                        {referencePhoto ? (
                          <div className="relative w-full aspect-video md:w-48 md:h-48 rounded-2xl border-2 border-primary/20 overflow-hidden group shadow-md">
                            <img src={referencePhoto} alt="Reference" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setReferencePhoto('')} className="bg-status-error text-white px-4 py-2 rounded-xl font-bold text-sm">Remove Image</button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full">
                            <ImageUpload 
                              service="product" 
                              endpoint="/products/upload-image" 
                              onUploadSuccess={(url) => setReferencePhoto(url)} 
                            />
                            <p className="text-[11px] text-text-muted mt-2 italic">Upload a photo of a similar design or a sketch to help the artisan provide an accurate quote.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Seller Info Card */}
            <div className="bg-background-surface border border-border rounded-2xl p-5 mb-8 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {product.seller?.name?.[0] || 'S'}
                </div>
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-0.5">Verified Artisan</p>
                  <p className="font-bold text-text-primary text-lg leading-tight">{product.seller?.name || 'Verified Seller'}</p>
                  <p className="text-xs text-text-secondary">
                    Market: <span className="capitalize">{params.slug.replace(/-/g, ' ')}</span> • Stall: {product.stallId || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 bg-status-warning/10 text-status-warning px-2 py-1 rounded-lg font-bold text-sm mb-1">
                  ⭐ {product.seller?.rating || 'New'}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex gap-4">
                {(
                  product.attributes?.isQuoteRequired === 'true' || 
                  product.attributes?.isQuoteRequired === true || 
                  product.attributes?.isCustomizable === 'true' || 
                  product.attributes?.isCustomizable === true ||
                  product.category === 'bakery' // Force quote flow for bakery items if they have any customization
                ) ? (
                  <div className="w-full space-y-4">
                    {!isSuccessModalOpen && (
                      <Button size="lg" className="w-full bg-amber-600 hover:bg-amber-700 py-4 text-lg shadow-lg shadow-amber-600/20" onClick={handleRequestQuote}>
                        📩 Send Messaging Quote Request
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Button size="lg" className="flex-1 py-4 text-lg shadow-lg shadow-primary/20" disabled={!product.inStock} onClick={handleAddToCart}>
                      Add to Cart
                    </Button>
                    <Button size="lg" variant="outline" className="flex-1 py-4 text-lg" onClick={handleAddToCart}>
                      <Link href="/cart" className="w-full block">Buy Now</Link>
                    </Button>
                  </>
                )}
              </div>
              <p className="text-center text-xs text-text-muted mt-5 font-medium">
                {(
                  product.attributes?.isQuoteRequired === 'true' || 
                  product.attributes?.isQuoteRequired === true || 
                  product.attributes?.isCustomizable === 'true' || 
                  product.attributes?.isCustomizable === true ||
                  product.category === 'bakery'
                ) 
                  ? '🛡️ Secure Messaging: You will chat directly with the baker to finalize details and price.'
                  : '🚚 Fast Delivery: Shipping calculated at checkout based on your sector.'}
              </p>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-20 pt-10 border-t border-border">
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-8">Customer Reviews</h2>
          
          {!reviews || reviews.length === 0 ? (
            <div className="bg-background-surface rounded-3xl p-12 text-center border-2 border-dashed border-border">
              <span className="text-5xl block mb-4">⭐</span>
              <p className="text-text-primary font-bold text-lg">No reviews yet for this product</p>
              <p className="text-text-secondary text-sm">Be the first to share your experience with other shoppers!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((review: any) => (
                <div key={review._id} className="bg-background-surface p-6 rounded-2xl border border-border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {review.buyerName?.[0] || review.buyerId?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-primary">{review.buyerName || 'Verified Buyer'}</p>
                        <p className="text-[10px] text-text-secondary">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex text-status-warning text-sm">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">
                    "{review.comment || 'The buyer didn\'t leave a comment but gave a high rating!'}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Shop Reviews Section */}
        <div className="mt-12 pt-10 border-t border-border">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-heading font-bold text-text-primary">About the Artisan & Shop Reviews</h2>
              <p className="text-sm text-text-secondary">Overall reputation of {product.seller?.name}</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-status-warning">⭐ {product.seller?.rating || 'New'}</span>
              <p className="text-xs text-text-muted">{sellerReviews.length} shop ratings</p>
            </div>
          </div>
          
          {sellerReviews.length === 0 ? (
            <div className="bg-background-surface rounded-2xl p-8 text-center text-text-secondary border border-border italic">
              No general shop reviews yet.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
              {sellerReviews.map((review: any) => (
                <div key={review._id} className="min-w-[300px] max-w-[300px] bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-status-warning font-bold">{'★'.repeat(review.rating)}</span>
                    <span className="text-[10px] text-text-muted">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-3 mb-4 flex-grow italic">
                    "{review.comment || 'Great service!'}"
                  </p>
                  <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {review.buyerName?.[0] || 'U'}
                    </div>
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-tighter">{review.buyerName || 'Verified Buyer'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center scale-in-center animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-status-success/10 text-status-success rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Request Sent!</h2>
              <p className="text-text-secondary mb-8">
                Your request for <strong>{product.name}</strong> has been sent. You can now chat directly with the artisan in the <strong>Negotiation Hub</strong> to discuss specific details, flavors, or delivery timing.
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
