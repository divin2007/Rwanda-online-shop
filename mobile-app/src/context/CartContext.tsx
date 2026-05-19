import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem } from '../types';

const CART_KEY = 'rmf.cart';

type CartContextType = {
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const itemKey = (item: Pick<CartItem, 'productId' | 'variantId'>) => `${item.productId}:${item.variantId || 'base'}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(CART_KEY)
      .then(value => {
        if (mounted && value) setItems(JSON.parse(value));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(current => {
      const key = itemKey(item);
      const existing = current.find(candidate => itemKey(candidate) === key);
      if (!existing) return [...current, item];
      return current.map(candidate =>
        itemKey(candidate) === key
          ? { ...candidate, quantity: candidate.quantity + item.quantity }
          : candidate,
      );
    });
  }, []);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, quantity: number) => {
    setItems(current => current
      .map(item => item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item)
      .filter(item => item.quantity > 0));
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems(current => current.filter(item => !(item.productId === productId && item.variantId === variantId)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextType>(() => ({
    items,
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }), [addItem, clearCart, items, removeItem, updateQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
};

