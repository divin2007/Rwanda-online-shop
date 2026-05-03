'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, cartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to proceed to checkout');
      router.push('/login');
    } else {
      router.push('/checkout');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-8">Your Cart</h1>
        
        {items.length === 0 ? (
          <div className="bg-background-card rounded-2xl p-12 text-center border border-border">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Your cart is empty</h2>
            <p className="text-text-secondary mb-6">Looks like you haven't added anything to your cart yet.</p>
            <Link href="/">
              <Button size="lg">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 bg-background-card p-4 rounded-xl border border-border">
                  <div className="w-24 h-24 bg-background-surface rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-text-primary">{item.name}</h3>
                        <p className="text-sm text-text-secondary">{item.price.toLocaleString()} RWF</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-text-muted hover:text-status-error">
                        ✕
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center border border-border rounded-lg bg-background-surface">
                        <button className="px-3 py-1 font-bold text-text-secondary hover:text-primary transition-colors" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>-</button>
                        <span className="px-3 py-1 font-bold text-sm min-w-[2rem] text-center">{item.quantity}</span>
                        <button className="px-3 py-1 font-bold text-text-secondary hover:text-primary transition-colors" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <span className="font-bold text-lg text-primary">
                        {(item.price * item.quantity).toLocaleString()} RWF
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div>
              <div className="bg-background-card p-6 rounded-xl border border-border sticky top-24">
                <h3 className="font-bold text-lg mb-4">Order Summary</h3>
                <div className="space-y-3 mb-6 pb-6 border-b border-border text-text-secondary">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{cartTotal.toLocaleString()} RWF</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-xl mb-6">
                  <span>Estimated Total</span>
                  <span className="text-primary">{cartTotal.toLocaleString()} RWF</span>
                </div>
                <Button fullWidth size="lg" onClick={handleCheckout}>
                  Proceed to Checkout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
