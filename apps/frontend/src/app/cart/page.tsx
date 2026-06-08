'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/format';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Store, 
  Tag, 
  Sparkles,
  CreditCard
} from 'lucide-react';

export default function CartPage() {
  const { t } = useLanguage();
  const { items, removeFromCart, updateQuantity, cartTotal } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Group cart items by seller/store for a multi-merchant checkout experience
  const itemsBySeller = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const sellerName = item.sellerName || 'Verified Seller';
      if (!groups[sellerName]) {
        groups[sellerName] = [];
      }
      groups[sellerName].push(item);
    });
    return groups;
  }, [items]);

  const handleCheckout = () => {
    if (authLoading) {
      toast.loading('Verifying secure connection...', { duration: 1000 });
      return;
    }
    
    if (!isAuthenticated) {
      toast.error('Please sign in to complete your transaction.');
      router.push(`/login?redirect=/cart`);
    } else {
      toast.loading('Encrypting checkout details...', { duration: 1000 });
      router.push('/checkout');
    }
  };

  return (
    <Layout>
      <div className="bg-[#fdfaf7] min-h-screen">
        <div className="rmf-container space-y-12 pb-40 pt-12 px-4 md:px-8 max-w-7xl mx-auto animate-reveal">
          
          {/* ── High-End Checkout Progress Stepper ── */}
          <div className="flex items-center justify-between max-w-3xl mx-auto mb-16 select-none bg-white/50 backdrop-blur-sm border border-[#ebdcd0]/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md shadow-primary/20">
                1
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-primary">Shopping Bag</span>
            </div>
            <div className="flex-grow h-[1px] bg-[#ebdcd0] mx-4 max-w-[80px] hidden sm:block" />
            <div className="flex items-center gap-3 opacity-40 hidden sm:flex">
              <div className="w-9 h-9 rounded-xl border border-[#ebdcd0] text-[#574e47] flex items-center justify-center font-bold text-sm bg-white">
                2
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#574e47]">Verification</span>
            </div>
            <div className="flex-grow h-[1px] bg-[#ebdcd0] mx-4 max-w-[80px] hidden sm:block" />
            <div className="flex items-center gap-3 opacity-40 hidden sm:flex">
              <div className="w-9 h-9 rounded-xl border border-[#ebdcd0] text-[#574e47] flex items-center justify-center font-bold text-sm bg-white">
                3
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#574e47]">Escrow Release</span>
            </div>
          </div>

          {/* ── Main Layout Column Grid ── */}
          {items.length === 0 ? (
            <div className="bg-white border border-[#ebdcd0] rounded-3xl py-28 text-center space-y-8 shadow-xl max-w-2xl mx-auto relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#ffedd5] to-white flex items-center justify-center mx-auto shadow-inner relative">
                <ShoppingBag className="text-primary w-10 h-10 stroke-[1.8]" />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#fca5a5] flex items-center justify-center text-red-700 text-xs font-black">
                  0
                </div>
              </div>
              <div className="space-y-4 max-w-md mx-auto px-6">
                <h2 className="text-3xl font-black text-[#17201a] tracking-tight">Your cart is empty</h2>
                <p className="text-sm text-[#80756c] leading-relaxed">
                  Embark on your culinary and commerce journey! Explore thousands of fresh harvests, spices, and custom products direct from local Rwandan merchants.
                </p>
              </div>
              <Link href="/markets" className="inline-flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover px-10 text-xs font-bold uppercase tracking-widest text-white shadow-md shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 mt-6">
                 Start Exploring Markets
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
              
              {/* ── LEFT: Shopping items list (Grouped by Seller) ── */}
              <div className="lg:col-span-8 space-y-8">
                {Object.entries(itemsBySeller).map(([sellerName, sellerItems]) => (
                  <div key={sellerName} className="bg-white border border-[#ebdcd0] rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/30 to-accent/30" />
                    
                    {/* Merchant Header Group */}
                    <div className="flex items-center gap-3 pb-6 border-b border-[#f2e8e0] mb-6">
                      <div className="w-9 h-9 rounded-xl bg-[#ffedd5] flex items-center justify-center text-primary shadow-inner">
                        <Store size={18} className="stroke-[2]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Merchant Stall</p>
                        <h4 className="text-lg font-black text-[#17201a] tracking-tight">{sellerName}</h4>
                      </div>
                    </div>

                    {/* Products belonging to this Seller */}
                    <div className="space-y-6">
                      {sellerItems.map((item, idx) => (
                        <div 
                          key={`${item.id}:${item.variantId || 'base'}:${item.customization || ''}`} 
                          className={`flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between pb-6 ${
                            idx < sellerItems.length - 1 ? 'border-b border-[#f2e8e0]/60' : ''
                          }`}
                        >
                          
                          {/* Left Half: Image & Titles */}
                          <div className="flex items-center gap-4 flex-grow">
                            <div className="w-20 h-20 bg-[#fcfcfc] border border-[#f2e8e0] rounded-2xl overflow-hidden flex-shrink-0 relative shadow-sm">
                              <img 
                                src={item.image || '/placeholder-product.png'} 
                                alt={item.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=60';
                                }}
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <h5 className="text-base font-bold text-[#17201a] tracking-tight hover:text-primary transition-colors line-clamp-1">
                                {item.name}
                              </h5>
                              {item.variantTitle && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary bg-[#ffedd5] border border-[#ff6b00]/10">
                                  <Tag size={8} /> {item.variantTitle}
                                </span>
                              )}
                              {item.customization && (
                                <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 mt-1 inline-block">
                                  ✏️ Custom: <span className="font-semibold text-emerald-800">{item.customization}</span>
                                </p>
                              )}
                              <p className="text-xs font-black text-[#80756c] mt-0.5">
                                {formatCurrency(item.price)} RWF / unit
                              </p>
                            </div>
                          </div>

                          {/* Right Half: Control & Total Price */}
                          <div className="flex items-center justify-between sm:justify-end gap-8 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                            
                            {/* Premium Quantity Adjuster widget */}
                            <div className="flex items-center rounded-2xl border border-[#ebdcd0] bg-[#fcfcfc] shadow-sm overflow-hidden h-10 px-1">
                              <button 
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-[#17201a] hover:bg-primary/10 hover:text-primary active:scale-95 transition-all" 
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1), item.variantId)}
                              >
                                <Minus size={12} className="stroke-[3]" />
                              </button>
                              <span className="w-10 text-center font-black text-sm text-[#17201a]">
                                {item.quantity}
                              </span>
                              <button 
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-[#17201a] hover:bg-primary/10 hover:text-primary active:scale-95 transition-all" 
                                onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                              >
                                <Plus size={12} className="stroke-[3]" />
                              </button>
                            </div>

                            {/* Subtotal & Delete Actions */}
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="text-base font-black text-[#17201a] tracking-tight">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                                <span className="text-[9px] font-black text-primary block tracking-widest uppercase">
                                  RWF
                                </span>
                              </div>
                              
                              <button 
                                onClick={() => removeFromCart(item.id, item.variantId)} 
                                className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100 flex items-center justify-center transition-all duration-200 hover:shadow-md active:scale-90"
                                aria-label="Remove product"
                              >
                                <Trash2 size={13} className="stroke-[2]" />
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* ── Secure Escrow Guarantee Box ── */}
                <div className="bg-gradient-to-br from-white to-[#fdfaf7] border border-[#ebdcd0] rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff6b00]/5 rounded-full -mr-8 -mt-8" />
                  <div className="w-12 h-12 rounded-2xl bg-[#ffedd5] flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                    <ShieldCheck size={26} className="stroke-[2]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-[#17201a] tracking-tight flex items-center gap-2">
                      RMF Escrow Protection Active
                      <Sparkles size={14} className="text-[#f59e0b] fill-[#f59e0b]" />
                    </h4>
                    <p className="text-xs text-[#80756c] leading-relaxed">
                      Your funds are held securely in escrow and are only transferred to sellers and logistics riders after you confirm receipt. Complete your marketplace orders with absolute confidence.
                    </p>
                  </div>
                </div>

              </div>

              {/* ── RIGHT: Summary checkout glass-card ── */}
              <div className="lg:col-span-4 sticky top-28">
                <div className="bg-white/95 backdrop-blur-md border border-[#ebdcd0] rounded-3xl p-8 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                  
                  <div className="flex items-center gap-2 mb-8">
                     <div className="w-6 h-1 bg-[#f59e0b] rounded-full" />
                     <p className="text-[10px] font-black text-[#f59e0b] uppercase tracking-widest">Pricing Invoice</p>
                  </div>
                  
                  {/* Ledger Details */}
                  <div className="space-y-4 mb-8 pb-8 border-b border-[#f2e8e0]">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#80756c]">Bag Subtotal</span>
                      <span className="text-lg font-black text-[#17201a] tracking-tight">
                        {formatCurrency(cartTotal)} <span className="text-[10px] font-bold text-[#80756c]">RWF</span>
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#80756c]">Gateway & Security</span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        FREE
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#80756c]">Delivery dispatch</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-[#ffedd5] px-2.5 py-0.5 rounded-full">
                        Calculated at checkout
                      </span>
                    </div>
                  </div>

                  {/* Total price highlight */}
                  <div className="flex justify-between items-end mb-10">
                    <span className="text-xs font-black uppercase tracking-widest text-[#17201a]">Estimated Total</span>
                    <div className="text-right">
                      <span className="text-4xl font-black tracking-tight text-primary drop-shadow-sm">
                        {formatCurrency(cartTotal)}
                      </span>
                       <p className="text-[9px] font-black uppercase tracking-widest text-[#80756c] mt-1">RWF</p>
                    </div>
                  </div>

                  {/* High End Call to Action Check button */}
                  {isAuthenticated ? (
                    <button 
                      onClick={handleCheckout}
                      className="flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Proceed to Secure Checkout
                      <ArrowRight size={14} className="stroke-[3.5]" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleCheckout}
                      disabled={authLoading}
                      className="flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-2xl bg-[#17201a] hover:bg-[#2e3e34] px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {authLoading ? 'Verifying...' : 'Sign In & Checkout'}
                      <Lock size={13} className="stroke-[3]" />
                    </button>
                  )}
                  
                  {/* Security trust badges */}
                  <div className="flex items-center justify-center gap-3 mt-8 pt-6 border-t border-[#f2e8e0]">
                    <CreditCard size={12} className="text-[#80756c]" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-center text-[#80756c]">
                      MTN MoMo & Airtel Secure Encryption
                    </p>
                  </div>
                  
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
