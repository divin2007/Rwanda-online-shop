'use client';
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { productApi, reviewApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();

  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { data: reviewsData } = useApi(reviewApi, 'get', `/reviews/target/product/${params.productId}`);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [customization, setCustomization] = React.useState('');
  const [qty, setQty] = React.useState(1);

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  const isWishlisted = product ? wishlist.includes(product._id) : false;

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) addToCart(product, customization);
    toast.success(`${product.name} added to cart!`);
  };

  if (loading) return (
    <Layout>
      <div className="rmf-container py-40 flex flex-col items-center gap-8">
        <div className="w-16 h-16 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-[#6B665E] uppercase tracking-widest">Loading product...</p>
      </div>
    </Layout>
  );

  if (!product) return (
    <Layout>
      <div className="rmf-container py-40 text-center">
        <p className="text-5xl mb-6">🛒</p>
        <h2 className="text-3xl font-serif italic text-[#121212] mb-4">Product not found</h2>
        <Link href="/markets" className="text-[#A34D15] font-black uppercase tracking-widest text-sm underline">Browse Markets →</Link>
      </div>
    </Layout>
  );

  const reviews = reviewsData || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const isOnDemand = product.stockType === 'on_demand';
  const isInStock = product.inStock !== false;

  return (
    <Layout>
      <div className="space-y-20 pb-32 animate-reveal">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-3 py-6 border-b border-[#F0EDE4] text-[10px] font-black uppercase tracking-[0.3em] flex-wrap">
          <Link href="/" className="text-[#6B665E] hover:text-[#121212] transition-colors">Home</Link>
          <span className="text-[#D0CBC4]">/</span>
          <Link href="/markets" className="text-[#6B665E] hover:text-[#121212] transition-colors">Markets</Link>
          <span className="text-[#D0CBC4]">/</span>
          <Link href={`/market/${params.slug}`} className="text-[#6B665E] hover:text-[#121212] transition-colors capitalize">{params.slug.replace(/-/g, ' ')}</Link>
          <span className="text-[#D0CBC4]">/</span>
          <span className="text-[#121212] opacity-50 truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* ── Main Product Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-20 items-start">

          {/* ── Left: Image Gallery ── */}
          <div className="space-y-6">
            {/* Main Image */}
            <div className="aspect-[4/5] bg-white border border-[#E5E1D8] overflow-hidden relative group shadow-lg">
              <img
                src={product.images?.[activeImageIndex] || 'https://placehold.co/800x1000/F8F6F1/121212?text=No+Image'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                alt={product.name}
              />
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isMadeInRwanda && (
                  <span className="bg-[#A34D15] text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5">🇷🇼 Made in Rwanda</span>
                )}
                {isOnDemand && (
                  <span className="bg-[#F59E0B] text-[#121212] text-[8px] font-black uppercase tracking-widest px-3 py-1.5">Made to Order</span>
                )}
                {!isInStock && !isOnDemand && (
                  <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5">Out of Stock</span>
                )}
              </div>
              {/* Wishlist */}
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center border-2 transition-all ${isWishlisted ? 'bg-[#121212] border-[#121212] text-white' : 'bg-white border-[#E5E1D8] text-[#6B665E] hover:border-[#121212] hover:text-[#121212]'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>

            {/* Thumbnails */}
            {product.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {product.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-[#121212] shadow-md' : 'border-[#E5E1D8] hover:border-[#A34D15]'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Info + Actions (Sticky) ── */}
          <div className="lg:sticky lg:top-28 space-y-8">

            {/* Category */}
            <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em]">{product.category || 'General'}</p>

            {/* Product Name */}
            <h1 className="text-4xl font-serif text-[#121212] leading-tight tracking-tighter italic">{product.name}</h1>

            {/* Rating Row */}
            {avgRating && (
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-sm ${s <= Math.round(Number(avgRating)) ? 'text-[#A34D15]' : 'text-[#E5E1D8]'}`}>★</span>
                  ))}
                </div>
                <span className="text-[11px] font-black text-[#6B665E] uppercase tracking-widest">{avgRating} ({reviews.length} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-4 py-6 border-y border-[#F0EDE4]">
              <span className="text-5xl font-serif tracking-tighter italic text-[#121212]">{product.price?.toLocaleString()}</span>
              <span className="text-xl font-serif text-[#A34D15] uppercase tracking-widest">RWF</span>
              {product.unit && <span className="text-[11px] font-bold text-[#6B665E] uppercase tracking-widest opacity-50">/ {product.unit}</span>}
            </div>

            {/* Stock / Availability */}
            <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${isInStock || isOnDemand ? 'text-green-700' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isInStock || isOnDemand ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {isOnDemand ? 'Made to Order — Contact seller for timeline' : isInStock ? `In Stock${product.stockQuantity ? ` (${product.stockQuantity} available)` : ''}` : 'Currently Out of Stock'}
            </div>

            {/* Custom Note */}
            {isOnDemand && (
              <div className="space-y-3">
                <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest block">Custom Request / Notes (optional)</label>
                <textarea
                  className="w-full bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm rounded-none outline-none min-h-[100px] transition-colors"
                  placeholder="Describe your size, colour preference, or special instructions..."
                  value={customization}
                  onChange={e => setCustomization(e.target.value)}
                />
              </div>
            )}

            {/* Quantity */}
            {!isOnDemand && isInStock && (
              <div className="flex items-center gap-4">
                <span className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest">Qty</span>
                <div className="flex border border-[#E5E1D8]">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-lg font-black text-[#121212] hover:bg-[#F8F6F1] transition-colors">−</button>
                  <div className="w-12 h-10 flex items-center justify-center font-black text-[#121212] border-x border-[#E5E1D8]">{qty}</div>
                  <button onClick={() => setQty(q => Math.min(product.stockQuantity || 99, q + 1))} className="w-10 h-10 flex items-center justify-center text-lg font-black text-[#121212] hover:bg-[#F8F6F1] transition-colors">+</button>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={!isInStock && !isOnDemand}
                className="w-full bg-[#121212] text-white py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isOnDemand ? '💬 Request This Item' : '🛒 Add to Cart'}
              </button>
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`w-full border-2 py-4 text-[11px] font-black uppercase tracking-[0.4em] transition-all ${isWishlisted ? 'border-[#121212] bg-[#121212] text-white' : 'border-[#121212]/20 text-[#121212] hover:border-[#121212]'}`}
              >
                {isWishlisted ? '♥ Saved to Wishlist' : '♡ Save to Wishlist'}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#F0EDE4]">
              {[
                { icon: '🔒', label: 'Secure Payment' },
                { icon: '🛵', label: 'Fast Delivery' },
                { icon: '🛡️', label: 'Buyer Protected' },
              ].map(b => (
                <div key={b.label} className="flex flex-col items-center gap-2 p-4 bg-[#F8F6F1] text-center">
                  <span className="text-xl">{b.icon}</span>
                  <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest leading-tight">{b.label}</p>
                </div>
              ))}
            </div>

            {/* Seller Card */}
            <div className="bg-[#121212] text-white p-8 flex items-center gap-6 group">
              <div className="w-14 h-14 bg-[#A34D15] flex items-center justify-center font-serif text-2xl italic flex-shrink-0">
                {product.seller?.name?.[0] || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-widest mb-1">Sold by</p>
                <p className="text-lg font-serif italic tracking-tight truncate">{product.seller?.name || 'Verified Seller'}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1 truncate">{params.slug.replace(/-/g, ' ')} Market</p>
              </div>
              <Link href={`/market/${params.slug}`} className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#F59E0B]/30 hover:border-[#F59E0B] transition-all whitespace-nowrap">
                View Shop →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-20">
          <div className="space-y-6">
            <h2 className="text-3xl font-serif italic text-[#121212] tracking-tighter border-b-2 border-[#121212] pb-6">About This Product</h2>
            <p className="text-lg text-[#6B665E] leading-relaxed italic font-light border-l-4 border-[#A34D15] pl-8">
              {product.description || 'A quality product from one of our verified local market sellers. Contact the seller for more details.'}
            </p>
            {product.weight > 0 && (
              <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest">Weight: {product.weight} kg</p>
            )}
          </div>
        </section>

        {/* ── Reviews ── */}
        <section className="pt-16 border-t-2 border-[#121212]">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.6em] mb-4">Customer Feedback</p>
              <h2 className="text-5xl font-serif text-[#121212] tracking-tighter italic leading-none">Reviews</h2>
            </div>
            {avgRating && (
              <div className="text-right">
                <p className="text-5xl font-serif italic text-[#121212]">{avgRating}</p>
                <div className="flex gap-0.5 justify-end mt-1">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-sm ${s <= Math.round(Number(avgRating)) ? 'text-[#A34D15]' : 'text-[#E5E1D8]'}`}>★</span>
                  ))}
                </div>
                <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-50 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-[#F0EDE4] bg-white">
              <p className="text-4xl mb-4">⭐</p>
              <p className="text-lg italic text-[#6B665E] font-light">No reviews yet — be the first to review this product!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {reviews.map((review: any) => (
                <div key={review._id} className="p-8 border border-[#E5E1D8] bg-white hover:border-[#121212] transition-all space-y-6 group">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 border-2 border-[#121212] flex items-center justify-center font-serif text-xl italic group-hover:bg-[#121212] group-hover:text-white transition-all">
                        {review.buyerName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.2em]">{review.buyerName || 'Verified Buyer'}</p>
                        <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-1 opacity-50">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= review.rating ? 'text-[#A34D15]' : 'text-[#E5E1D8]'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-base text-[#121212] leading-relaxed italic font-light">
                    "{review.comment || 'Great product!'}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}
