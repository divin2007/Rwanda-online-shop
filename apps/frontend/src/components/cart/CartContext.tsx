'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sellerId?: string;
  sellerUserId?: string;
  sellerName?: string;
  stallId?: string;
  marketId?: string;
  unit?: string;
  customization?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, customization?: string) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('rwshop_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('rwshop_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product: any, customization?: string) => {
    setItems((prevItems) => {
      // If customized, always treat as a unique item so multiple different customizations can exist
      const existingItem = !customization ? prevItems.find((item) => item.id === (product.id || product._id) && !item.customization) : null;
      
      if (existingItem) {
        return prevItems.map((item) =>
          (item.id === (product.id || product._id) && !item.customization) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      // Use promoted price if available
      const price = product.promotion?.promotedPrice || product.price;

      // Extract seller info from populated object if possible
      const seller = typeof product.sellerId === 'object' ? product.sellerId : null;
      const sellerId = seller ? seller._id : product.sellerId;
      const sellerUserId = seller ? seller.userId : product.sellerUserId;
      const sellerName = seller?.shopDetails?.name || product.sellerName || 'Verified Seller';
      const stallId = seller?.stallId || product.stallId || 'N/A';
      
      // Extract market info from populated object
      const market = typeof product.marketId === 'object' ? product.marketId : null;
      const marketId = market ? market._id : product.marketId;

      return [...prevItems, { 
        id: product.id || product._id, 
        name: product.name, 
        price: price, 
        quantity: 1,
        image: product.image || (product.images && product.images[0]),
        sellerId,
        sellerUserId,
        sellerName,
        stallId,
        marketId,
        unit: product.unit,
        customization
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    setItems((prevItems) => prevItems.map(item => 
      item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
