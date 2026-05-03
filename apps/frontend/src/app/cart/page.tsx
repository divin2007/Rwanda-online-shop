'use client';
import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/components/cart/CartContext';

export default function CartPage() {
  const { items, removeFromCart, cartTotal, clearCart } = useCart();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-8">Your Cart</h1>

        {items.length === 0 ? (
          <Card className="text-center py-16 animate-fade-in">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Your cart is empty</h2>
            <p className="text-text-secondary mb-6">Looks like you haven't added anything to your cart yet.</p>
            <Link href="/">
              <Button>Continue Shopping</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="flex gap-4 items-center animate-fade-in" noPadding>
                  <div className="w-24 h-24 bg-background-surface flex-shrink-0 flex items-center justify-center text-text-muted">
                    {item.image || 'Image'}
                  </div>
                  <div className="flex-grow py-4">
                    <h3 className="font-bold text-lg text-text-primary">{item.name}</h3>
                    <p className="text-text-secondary">{item.price} RWF x {item.quantity}</p>
                  </div>
                  <div className="pr-4 flex flex-col items-end gap-2">
                    <span className="font-bold text-lg">{item.price * item.quantity} RWF</span>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-status-error text-sm font-medium hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </Card>
              ))}
              
              <div className="flex justify-between items-center pt-4">
                <button onClick={clearCart} className="text-text-secondary text-sm font-medium hover:text-status-error hover:underline transition-colors">
                  Clear Cart
                </button>
                <Link href="/" className="text-primary text-sm font-bold hover:underline">
                  ← Continue Shopping
                </Link>
              </div>
            </div>

            <Card className="sticky top-24">
              <h2 className="text-xl font-heading font-bold mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm pb-4 border-b border-border">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                  <span className="font-medium">{cartTotal} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Delivery Estimate</span>
                  <span className="font-medium">Calculated at checkout</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-xl pt-4 mb-6">
                <span>Total</span>
                <span className="text-primary">{cartTotal} RWF</span>
              </div>
              <Link href="/checkout" className="block w-full">
                <Button fullWidth size="lg">Proceed to Checkout</Button>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
