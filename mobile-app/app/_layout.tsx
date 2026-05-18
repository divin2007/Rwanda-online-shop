import React, { createContext, useState, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ── Auth Context ──
export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (phone: string, fullName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ── Cart Context ──
export interface CartItem {
  id: string;
  name: string;
  price: number; // total unit price including variant markup
  quantity: number;
  unit: string;
  category: string;
  categoryId?: string;
  image?: string;
  variantId?: string;
  variantTitle?: string;
  sellerSku?: string;
  sellerId?: string;
  sellerUserId?: string;
  sellerName?: string;
  stallId?: string;
  marketId?: string;
}

interface CartContextType {
  items: CartItem[];
  cartTotal: number;
  addToCart: (item: CartItem) => void;
  removeFromCart: (variantIdOrProductId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};

// ── Root Layout Component ──
export default function RootLayout() {
  const [user, setUser] = useState<User | null>({
    id: '6a0b828384bd8fb2fa9cabce',
    fullName: 'Murekatete Seller',
    phone: '0788888888',
    role: 'seller'
  });
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const login = (phone: string, fullName: string) => {
    setUser({
      id: '6a0b828384bd8fb2fa9cabce',
      fullName,
      phone,
      role: 'buyer'
    });
  };

  const logout = () => {
    setUser(null);
  };

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      const key = item.variantId || item.id;
      const existing = prev.find(i => (i.variantId || i.id) === key);
      if (existing) {
        return prev.map(i => (i.variantId || i.id) === key ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (variantIdOrProductId: string) => {
    setCartItems(prev => prev.filter(i => (i.variantId || i.id) !== variantIdOrProductId));
  };

  const clearCart = () => setCartItems([]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={{ user, login, logout }}>
        <CartContext.Provider value={{ items: cartItems, cartTotal, addToCart, removeFromCart, clearCart }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#012d1d' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { fontWeight: 'bold' },
              headerBackTitleVisible: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
            <Stack.Screen name="product/[productId]" options={{ title: 'Product Details' }} />
            <Stack.Screen name="orders/[orderId]" options={{ title: 'Live Tracking' }} />
          </Stack>
        </CartContext.Provider>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
