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
    console.log('[RMF-LOG] Checkout triggered. Auth State:', { isAuthenticated, authLoading });
    
    if (authLoading) {
      toast.loading('Synchronizing security credentials...', { duration: 1000 });
      return;
    }
    
    if (!isAuthenticated) {
      console.warn('[RMF-LOG] Checkout aborted: Unauthorized session.');
      toast.error(t('login_required_checkout') || 'Authorization Required: Please sign in to proceed.');
      router.push(`/login?redirect=/cart`);
    } else {
      console.log('[RMF-LOG] Checkout authorized. Redirecting to logistics matrix.');
      toast.loading('Redirecting to checkout...', { duration: 1000 });
      router.push('/checkout');
    }
  };

  return (
    <Layout>
      <div className="space-y-32 pb-40 animate-reveal">
        {/* Mandate Registry Header */}
        <div className="border-b-2 border-[#121212] pb-16">
          <div className="flex items-center gap-6 mb-8">
             <div className="w-12 h-px bg-[#A34D15]"></div>
             <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em]">{t('official_facilitator')}</p>
          </div>
          <h1 className="text-[100px] font-serif text-[#121212] leading-[0.85] tracking-tighter italic">{t('cart_title')}</h1>
        </div>

        {items.length === 0 ? (
          <div className="bg-white border-4 border-dashed border-[#F0EDE4] py-60 text-center space-y-16">
            <div className="text-8xl opacity-10 italic font-serif select-none">Empty Registry</div>
            <div className="space-y-6">
              <h2 className="text-4xl font-serif text-[#121212] italic tracking-tighter">{t('cart_empty')}</h2>
              <p className="text-xl text-[#6B665E] font-light italic max-w-xl mx-auto">{t('cart_empty_desc')}</p>
            </div>
            <Link href="/markets" className="inline-block rmf-btn-primary bg-[#121212] hover:bg-[#A34D15] px-20">
               {t('start_shopping')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-32 items-start">
            {/* Artifact List */}
            <div className="lg:col-span-8 space-y-16">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-12 group border-b border-[#F0EDE4] pb-16 last:border-0 relative">
                  <div className="w-60 h-60 bg-white border-2 border-[#121212] overflow-hidden flex-shrink-0 relative p-4 group-hover:shadow-2xl transition-all">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
                    <div className="absolute top-0 left-0 bg-[#121212] text-white text-[8px] font-black uppercase px-3 py-1">ARTIFACT</div>
                  </div>
                  
                  <div className="flex-grow flex flex-col justify-between py-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.4em] italic">{t('master_artisan')} Faciliated</p>
                        <h3 className="text-4xl font-serif text-[#121212] tracking-tighter italic leading-none group-hover:text-[#A34D15] transition-colors">{item.name}</h3>
                        <p className="text-xl font-serif italic text-[#121212]/40 tracking-tighter pt-2">{formatCurrency(item.price)}</p>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="w-12 h-12 border-2 border-[#121212]/10 flex items-center justify-center text-[#121212] hover:bg-[#A34D15] hover:text-white hover:border-[#A34D15] transition-all font-serif"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex flex-wrap justify-between items-end mt-12 gap-8">
                      <div className="flex items-center border-2 border-[#121212] bg-white">
                        <button className="w-12 h-12 flex items-center justify-center font-black text-[#121212] hover:bg-[#F8F6F1] transition-colors" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>-</button>
                        <span className="w-16 text-center font-serif text-lg italic font-bold text-[#121212] border-x-2 border-[#121212] h-12 flex items-center justify-center">{item.quantity}</span>
                        <button className="w-12 h-12 flex items-center justify-center font-black text-[#121212] hover:bg-[#F8F6F1] transition-colors" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-[0.3em] mb-2 opacity-50">Acquisition Subtotal</p>
                        <span className="text-4xl font-serif italic tracking-tighter font-black text-[#121212]">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic Summary */}
            <div className="lg:col-span-4">
              <div className="bg-[#121212] text-white p-16 sticky top-32 shadow-[50px_50px_100px_-50px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-6 mb-12">
                   <div className="w-12 h-px bg-[#A34D15]"></div>
                   <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em] italic">Mandate Ledger</p>
                </div>
                
                <div className="space-y-10 mb-16 pb-16 border-b border-white/10">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">{t('cart_subtotal')}</span>
                    <span className="text-3xl font-serif italic tracking-tighter">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">{t('cart_delivery')}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A34D15]">{t('cart_calculated_at_checkout')}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-20">
                  <span className="text-[11px] font-black uppercase tracking-[0.5em] opacity-50 italic">{t('cart_estimated_total')}</span>
                  <div className="text-right">
                    <span className="text-6xl font-serif italic tracking-tighter font-black">{formatCurrency(cartTotal)}</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A34D15] mt-4">RWF Authorized</p>
                  </div>
                </div>

                {isAuthenticated ? (
                  <Link 
                    href="/checkout"
                    onClick={() => toast.loading('Redirecting to checkout...', { duration: 1000 })}
                    className="rmf-btn-primary w-full py-8 text-[11px] bg-white text-[#121212] hover:bg-[#A34D15] hover:text-white border-none flex items-center justify-center no-underline"
                  >
                    {t('cart_proceed_checkout')} →
                  </Link>
                ) : (
                  <button 
                    onClick={handleCheckout}
                    disabled={authLoading}
                    className="rmf-btn-primary w-full py-8 text-[11px] bg-white text-[#121212] hover:bg-[#A34D15] hover:text-white border-none disabled:opacity-50"
                  >
                    {authLoading ? 'Authorizing...' : `${t('cart_proceed_checkout')} →`}
                  </button>
                )}
                
                <p className="text-[9px] font-black uppercase tracking-[0.6em] text-center mt-10 opacity-20 italic">Secure Facilitation Protocol Active</p>
                
                {/* Visual Decoration */}
                <div className="absolute -bottom-20 -left-20 text-[200px] font-serif opacity-5 italic select-none">RMF</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
