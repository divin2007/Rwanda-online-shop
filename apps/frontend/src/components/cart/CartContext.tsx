'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  // Menu-item (food/dining) fields
  menuItemId?: string;
  isMenuItem?: boolean;
  preparationMinutes?: number;
  selectedModifiers?: Array<{ name: string; label: string; extraPrice: number }>;
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
  // Menu-item (food/dining) fields
  menuItemId?: string;
  isMenuItem?: boolean;
  preparationMinutes?: number;
  selectedModifiers?: Array<{ name: string; label: string; extraPrice: number }>;
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

// ---------------------------------------------------------------------------
// Cart persistence: cookie scoped to the registrable domain so the cart is
// shared across market subdomains (e.g. kimironko.rwshop.org and the apex).
// localStorage is per-origin and would NOT survive a subdomain hop, which is
// why we use a cookie with an explicit parent-domain scope here.
// ---------------------------------------------------------------------------
const CART_COOKIE = 'rmf_cart';
const CART_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, in seconds

// Resolve the cookie Domain attribute. In production we want the cart visible
// across *.rwshop.org; in local/dev we fall back to the bare hostname (cookies
// cannot be scoped to a parent of a single-label host like "localhost").
const getCookieDomain = (): string => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    // localhost / raw IP: omit Domain so the cookie stays host-only.
    return '';
  }
  if (host.endsWith('rwshop.org')) return '.rwshop.org';
  // Generic fallback: scope to the registrable parent (last two labels).
  const parts = host.split('.');
  return parts.length >= 2 ? '.' + parts.slice(-2).join('.') : '';
};

const getCartCookie = (): CartItem[] => {
  if (typeof document === 'undefined') return [];
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CART_COOKIE}=`));
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
  } catch (e) {
    console.error('Failed to parse cart cookie', e);
    return [];
  }
};

const setCartCookie = (items: CartItem[]) => {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  let cookie = `${CART_COOKIE}=${encodeURIComponent(JSON.stringify(items))}; path=/; max-age=${CART_MAX_AGE}; SameSite=Lax`;
  if (domain) cookie += `; domain=${domain}`;
  if (secure) cookie += '; Secure';
  document.cookie = cookie;
};

const clearCartCookie = () => {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  let cookie = `${CART_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load cart from the shared cookie on mount. One-time migration: if a legacy
  // localStorage cart exists and the cookie is empty, adopt it then clear it.
  useEffect(() => {
    const cookieCart = getCartCookie();
    if (cookieCart.length > 0) {
      setItems(cookieCart);
      setHydrated(true);
      return;
    }
    try {
      const legacy = localStorage.getItem('rwshop_cart');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          setCartCookie(parsed);
        }
        localStorage.removeItem('rwshop_cart');
      }
    } catch (e) {
      console.error('Failed to migrate legacy cart', e);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist cart to the shared cookie on every change.
  useEffect(() => {
    if (!hydrated) return;
    if (items.length > 0) {
      setCartCookie(items);
    } else {
      clearCartCookie();
    }
  }, [hydrated, items]);

  const addToCart = useCallback((product: CartProductInput, customization?: string) => {
    setItems((prevItems) => {
      const productId = product.id || product._id;
      const variantId = product.variantId;

      // For menu items, the selected-modifier combination is part of the identity:
      // the same item with a different modifier choice is a separate cart line,
      // but the identical choice stacks quantity.
      const modifierSignature = product.isMenuItem
        ? JSON.stringify((product.selectedModifiers || []).map((m) => `${m.name}:${m.label}`).sort())
        : undefined;

      if (product.isMenuItem) {
        const existingMenuItem = prevItems.find(
          (item) =>
            item.isMenuItem &&
            item.menuItemId === (product.menuItemId || productId) &&
            JSON.stringify((item.selectedModifiers || []).map((m) => `${m.name}:${m.label}`).sort()) === modifierSignature
        );
        if (existingMenuItem) {
          return prevItems.map((item) =>
            item === existingMenuItem ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
      }

      // If customized, always treat as a unique item so multiple different customizations can exist
      const existingItem = !customization && !product.isMenuItem
        ? prevItems.find((item) => item.id === productId && item.variantId === variantId && !item.customization && !item.isMenuItem)
        : null;

      if (existingItem) {
        return prevItems.map((item) =>
          (item.id === productId && item.variantId === variantId && !item.customization && !item.isMenuItem) ? { ...item, quantity: item.quantity + 1 } : item
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
        customization,
        // Menu-item fields
        menuItemId: product.isMenuItem ? (product.menuItemId || productId) : undefined,
        isMenuItem: product.isMenuItem,
        preparationMinutes: product.preparationMinutes,
        selectedModifiers: product.selectedModifiers,
      }];
    });
  }, []);

  const removeFromCart = useCallback((id: string, variantId?: string) => {
    setItems((prevItems) => prevItems.filter((item) => !(item.id === id && item.variantId === variantId)));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, variantId?: string) => {
    setItems((prevItems) => prevItems.map(item => 
      item.id === id && item.variantId === variantId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

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
