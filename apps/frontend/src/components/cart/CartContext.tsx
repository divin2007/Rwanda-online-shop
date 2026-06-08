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
  category?: string;
  categoryId?: string;
  attributes?: Record<string, unknown>;
  variantId?: string;
  variantTitle?: string;
  sellerSku?: string;
  customization?: string;
}

type CartProductInput = {
  id?: string;
  _id?: string;
  name?: string;
  price?: number;
  image?: string;
  images?: string[];
  promotion?: { promotedPrice?: number };
  sellerId?: string | { _id?: string; userId?: string; stallId?: string; shopDetails?: { name?: string } };
  sellerUserId?: string;
  sellerName?: string;
  seller?: { _id?: string; userId?: string; stallId?: string; shopDetails?: { name?: string } };
  stallId?: string;
  marketId?: string | { _id?: string };
  unit?: string;
  category?: string;
  categoryId?: string;
  attributes?: Record<string, unknown>;
  variantId?: string;
  variantTitle?: string;
  sellerSku?: string;
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: CartProductInput, customization?: string) => void;
  removeFromCart: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const asStringId = (value: unknown) => typeof value === 'string' ? value : undefined;

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

  const addToCart = (product: CartProductInput, customization?: string) => {
    setItems((prevItems) => {
      const productId = product.id || product._id;
      const variantId = product.variantId;
      // If customized, always treat as a unique item so multiple different customizations can exist
      const existingItem = !customization
        ? prevItems.find((item) => item.id === productId && item.variantId === variantId && !item.customization)
        : null;
      
      if (existingItem) {
        return prevItems.map((item) =>
          (item.id === productId && item.variantId === variantId && !item.customization) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      // Use promoted price if available
      const price = product.promotion?.promotedPrice || product.price || 0;

      // Extract seller info from populated object if possible
      const seller = typeof product.sellerId === 'object' ? product.sellerId : null;
      const sellerId = seller?._id || asStringId(product.sellerId) || product.seller?._id;
      const sellerUserId = seller ? seller.userId : (product.sellerUserId || product.seller?.userId);
      const sellerName = seller?.shopDetails?.name || product.sellerName || product.seller?.shopDetails?.name || 'Verified Seller';
      const stallId = seller?.stallId || product.stallId || product.seller?.stallId || 'N/A';
      
      // Extract market info from populated object
      const market = typeof product.marketId === 'object' ? product.marketId : null;
      const marketId = market?._id || asStringId(product.marketId);

      return [...prevItems, { 
        id: productId || `${Date.now()}`, 
        name: product.name || 'Product', 
        price: price, 
        quantity: 1,
        image: product.image || (product.images && product.images[0]),
        sellerId,
        sellerUserId,
        sellerName,
        stallId,
        marketId,
        unit: product.unit,
        category: product.category,
        categoryId: product.categoryId,
        attributes: product.attributes,
        variantId: product.variantId,
        variantTitle: product.variantTitle,
        sellerSku: product.sellerSku,
        customization
      }];
    });
  };

  const removeFromCart = (id: string, variantId?: string) => {
    setItems((prevItems) => prevItems.filter((item) => !(item.id === id && item.variantId === variantId)));
  };

  const updateQuantity = (id: string, quantity: number, variantId?: string) => {
    setItems((prevItems) => prevItems.map(item => 
      item.id === id && item.variantId === variantId ? { ...item, quantity: Math.max(1, quantity) } : item
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
