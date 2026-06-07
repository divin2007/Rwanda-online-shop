import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { api } from '../src/lib/api';
import { colors } from '../src/theme';

export default function RootLayout() {
  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pathname) return;
    setTransitioning(true);
    progress.setValue(0);

    Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.65,
        duration: 350,
        useNativeDriver: false,
      }),
      Animated.timing(progress, {
        toValue: 1.0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setTimeout(() => {
        setTransitioning(false);
      }, 200);
    });
  }, [pathname, progress]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              {transitioning && (
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              )}
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
                <Stack.Screen name="(auth)/rider-onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/rider-pending" options={{ headerShown: false }} />
                <Stack.Screen name="market/[marketId]" options={{ title: 'Market' }} />
                <Stack.Screen name="product/[productId]" options={{ title: 'Product' }} />
                <Stack.Screen name="orders/[orderId]" options={{ title: 'Order tracking' }} />
                <Stack.Screen name="seller/onboarding" options={{ title: 'Seller onboarding' }} />
                <Stack.Screen name="seller/products" options={{ title: 'Inventory' }} />
                <Stack.Screen name="seller/promotions" options={{ title: 'Promotions' }} />
                <Stack.Screen name="seller/orders/index" options={{ title: 'Seller orders' }} />
                <Stack.Screen name="seller/orders/[orderId]" options={{ title: 'Seller order' }} />
                <Stack.Screen name="seller/analytics" options={{ title: 'Analytics' }} />
                <Stack.Screen name="seller/earnings" options={{ title: 'Earnings & Wallet' }} />
                <Stack.Screen name="seller/reviews" options={{ title: 'Reviews' }} />
                <Stack.Screen name="seller/qr" options={{ title: 'My Stall QR' }} />
                <Stack.Screen name="rider/deliveries" options={{ title: 'Deliveries' }} />
                <Stack.Screen name="rider/earnings" options={{ title: 'Rider Earnings' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="preferences" options={{ title: 'Recommendations' }} />
                <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
                <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
                <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
              </Stack>
            </View>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: colors.orange,
    zIndex: 99999,
    elevation: 99999,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
