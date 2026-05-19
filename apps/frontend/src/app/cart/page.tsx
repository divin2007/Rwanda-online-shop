'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/format';

export default function CartPage() {
  const { t } = useLanguage();
  const { items, removeFromCart, updateQuantity, cartTotal } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const handleCheckout = () => {
    if (authLoading) {
      toast.loading('Checking account status...', { duration: 1000 });
      return;
    }
    
    if (!isAuthenticated) {
      toast.error('Please sign in to proceed to checkout.');
      router.push(`/login?redirect=/cart`);
    } else {
      toast.loading('Redirecting to checkout...', { duration: 1000 });
      router.push('/checkout');
    }
  };

  return (
    <Layout>
      <div className="rmf-container space-y-16 pb-40 pt-10 px-4 md:px-8 animate-reveal">
        {/* ── Header ── */}
        <div className="border-b border-border-light pb-10">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-1 bg-accent-premium rounded-full" />
             <p className="text-[11px] font-bold text-primary uppercase tracking-widest">Your Cart</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">Shopping Bag</h1>
        </div>

        {items.length === 0 ? (
          <div className="bg-background-surface border border-dashed border-border-light rounded-2xl py-32 text-center space-y-8 cinematic-shadow">
            <div className="text-7xl opacity-40 select-none drop-shadow-md">🛍️</div>
            <div className="space-y-4 max-w-lg mx-auto">
              <h2 className="text-3xl font-bold text-text-primary tracking-tight">Your cart is empty</h2>
              <p className="text-base text-text-muted leading-relaxed">Looks like you haven't added anything to your cart yet. Discover fresh products from our local markets.</p>
            </div>
            <Link href="/markets" className="inline-flex min-h-[3.5rem] items-center justify-center rounded-xl bg-primary px-10 text-sm font-bold uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/30 mt-6">
               Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 xl:gap-24 items-start">
            
            {/* ── Cart Items ── */}
            <div className="lg:col-span-8 space-y-6">
              {items.map((item) => (
                <div key={`${item.id}:${item.variantId || 'base'}:${item.customization || ''}`} className="flex flex-col sm:flex-row gap-6 sm:gap-8 group border border-border-light bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Image */}
                  <div className="w-full sm:w-40 h-40 bg-background-surface rounded-xl overflow-hidden flex-shrink-0 relative group-hover:border-primary/20 transition-colors">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  
                  {/* Details */}
                  <div className="flex-grow flex flex-col justify-between py-1">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-accent-premium uppercase tracking-widest">Verified Seller</p>
                        <h3 className="text-2xl font-bold text-text-primary tracking-tight leading-tight transition-colors group-hover:text-primary">{item.name}</h3>
                        {item.variantTitle && <p className="text-xs font-black uppercase tracking-widest text-primary">{item.variantTitle}</p>}
                        <p className="text-lg font-bold text-text-muted">{formatCurrency(item.price)}</p>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id, item.variantId)} 
                        className="w-10 h-10 rounded-full border border-border-light bg-background-surface flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex flex-wrap justify-between items-end mt-8 gap-6">
                      {/* Quantity Control */}
                      <div className="flex items-center rounded-xl border border-border-light bg-white shadow-sm overflow-hidden h-12">
                        <button className="w-12 h-full flex items-center justify-center text-lg font-medium text-text-primary hover:bg-primary/5 transition-colors" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1), item.variantId)}>-</button>
                        <span className="w-12 text-center font-bold text-base text-text-primary border-x border-border-light h-full flex items-center justify-center bg-background-surface/50">{item.quantity}</span>
                        <button className="w-12 h-full flex items-center justify-center text-lg font-medium text-text-primary hover:bg-primary/5 transition-colors" onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}>+</button>
                      </div>
                      
                      {/* Subtotal */}
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Subtotal</p>
                        <span className="text-2xl font-bold tracking-tight text-text-primary">
                          {formatCurrency(item.price * item.quantity)} <span className="text-xs font-bold text-primary uppercase tracking-widest ml-1">RWF</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Order Summary ── */}
            <div className="lg:col-span-4">
              <div className="bg-primary-cinematic text-white p-8 lg:p-10 sticky top-32 rounded-2xl shadow-xl cinematic-shadow border border-white/5">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-8 h-1 bg-accent-premium rounded-full" />
                   <p className="text-[11px] font-bold text-accent-premium uppercase tracking-widest">Order Summary</p>
                </div>
                
                <div className="space-y-5 mb-8 pb-8 border-b border-white/10">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Subtotal</span>
                    <span className="text-xl font-bold tracking-tight">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Delivery</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-premium bg-accent-premium/10 px-2 py-1 rounded-full">Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-10">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/80">Estimated Total</span>
                  <div className="text-right">
                    <span className="text-4xl font-bold tracking-tight text-white drop-shadow-md">{formatCurrency(cartTotal)}</span>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-accent-premium mt-1.5">RWF</p>
                  </div>
                </div>

                {isAuthenticated ? (
                  <Link 
                    href="/checkout"
                    onClick={() => toast.loading('Redirecting to checkout...', { duration: 1000 })}
                    className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-accent-premium px-6 text-xs font-bold uppercase tracking-widest text-primary shadow-md shadow-accent-premium/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-premium/30"
                  >
                    Proceed to Checkout →
                  </Link>
                ) : (
                  <button 
                    onClick={handleCheckout}
                    disabled={authLoading}
                    className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-xs font-bold uppercase tracking-widest text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {authLoading ? 'Checking...' : 'Proceed to Checkout →'}
                  </button>
                )}
                
                <p className="text-[10px] font-bold uppercase tracking-widest text-center mt-6 text-white/40">Secure Checkout Guarantee</p>
                
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
