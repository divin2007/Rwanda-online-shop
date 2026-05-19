import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.ink,
                headerShadowVisible: true,
                headerTitleStyle: { fontWeight: '900' },
                contentStyle: { backgroundColor: colors.paper },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
              <Stack.Screen name="market/[marketId]" options={{ title: 'Market' }} />
              <Stack.Screen name="product/[productId]" options={{ title: 'Product' }} />
              <Stack.Screen name="orders/[orderId]" options={{ title: 'Order tracking' }} />
              <Stack.Screen name="videos" options={{ title: 'Seller videos' }} />
              <Stack.Screen name="seller/onboarding" options={{ title: 'Seller onboarding' }} />
              <Stack.Screen name="seller/products" options={{ title: 'Inventory' }} />
              <Stack.Screen name="seller/promotions" options={{ title: 'Promotions' }} />
              <Stack.Screen name="seller/orders/[orderId]" options={{ title: 'Seller order' }} />
              <Stack.Screen name="rider/deliveries" options={{ title: 'Deliveries' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="preferences" options={{ title: 'Recommendations' }} />
              <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
              <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
              <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            </Stack>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
