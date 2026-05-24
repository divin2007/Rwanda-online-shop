import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import {
  Bike, BriefcaseBusiness, Home, MapPinned,
  ReceiptText, UserCircle, Tag, Video,
} from 'lucide-react-native';
import { AppHeaderSearch } from '../../src/components/AppHeader';
import { colors } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Alibaba-style Tab Layout
// – Signature orange-red header bar with white search + icons
// – Clean white tab bar with orange active indicators
// – Proper iOS safe area handling
// ─────────────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const roleLabel = user?.role === 'SELLER' ? 'Seller'
    : user?.role === 'RIDER' ? 'Rider'
    : user?.role === 'ADMIN' ? 'Admin'
    : 'Me';

  const RoleIcon = user?.role === 'RIDER' ? Bike
    : (user?.role === 'SELLER' || user?.role === 'ADMIN') ? BriefcaseBusiness
    : UserCircle;

  const roleHref = user?.role === 'SELLER' ? '/seller'
    : user?.role === 'RIDER' ? '/rider/deliveries'
    : user?.role === 'ADMIN' ? '/seller'
    : null;

  // Rider approval gate
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'RIDER') return;
    api.get<any>('rider', '/riders/me').then(res => {
      const rider = (res as any)?.data || res;
      if (!rider) {
        router.replace('/(auth)/rider-onboarding');
      } else if (rider.isApproved !== true) {
        router.replace('/(auth)/rider-pending');
      }
    }).catch((err: any) => {
      if (err?.status === 404) router.replace('/(auth)/rider-onboarding');
    });
  }, [isAuthenticated, user?.role]);

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 82 : 60;

  return (
    <Tabs
      screenOptions={{
        // ── Header — Alibaba signature orange-red ──────────────────────────
        headerStyle: {
          backgroundColor: colors.primary,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: colors.card,
        headerTitle: () => <AppHeaderSearch />,
        headerTitleAlign: 'left',
        headerTitleContainerStyle: {
          left: 0,
          right: 0,
          marginHorizontal: 0,
          paddingHorizontal: 12,
        },
        headerLeft: () => null,
        headerRight: () => null,
        headerShadowVisible: false,

        // ── Tab bar — clean white with orange active state ─────────────────
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0.5,
          borderTopColor: colors.divider,
          height: TAB_BAR_HEIGHT,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 6,
          // Subtle top shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 1} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarLabel: 'Markets',
          tabBarIcon: ({ color, size }) => <MapPinned color={color} size={size - 1} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarLabel: 'Products',
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size - 1} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Videos',
          tabBarLabel: 'Videos',
          tabBarIcon: ({ color, size }) => <Video color={color} size={size - 1} strokeWidth={2} />,
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          // Override header for cart — cleaner centered title
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: 'My Cart',
          headerTitleAlign: 'center',
          headerTitleContainerStyle: { left: 16, right: 16 },
          headerLeft: undefined,
          headerRight: undefined,
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size - 1} strokeWidth={2} />,
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: 'My Orders',
          headerTitleAlign: 'center',
          headerTitleContainerStyle: { left: 16, right: 16 },
          headerLeft: undefined,
          headerRight: undefined,
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen
        name="seller"
        options={{
          title: roleLabel,
          tabBarLabel: roleLabel,
          href: isAuthenticated ? roleHref : null,
          tabBarIcon: ({ color, size }) => <RoleIcon color={color} size={size - 1} strokeWidth={2} />,
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: roleLabel,
          headerTitleAlign: 'center',
          headerTitleContainerStyle: { left: 16, right: 16 },
          headerLeft: undefined,
          headerRight: undefined,
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size - 1} strokeWidth={2} />,
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: 'My Account',
          headerTitleAlign: 'center',
          headerTitleContainerStyle: { left: 16, right: 16 },
          headerLeft: undefined,
          headerRight: undefined,
          headerShadowVisible: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});
