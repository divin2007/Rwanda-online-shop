import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
  const renderTabIcon = (Icon: any) => ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
      <Icon color={focused ? colors.card : color} size={size - 1} strokeWidth={focused ? 2.4 : 2} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        // ── Header — Alibaba signature orange-red ──────────────────────────
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: colors.primary,
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
        tabBarActiveTintColor: colors.primaryMid,
        tabBarInactiveTintColor: '#5e5e5e',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceHigh,
          height: TAB_BAR_HEIGHT,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 6,
          // Subtle top shadow
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          shadowColor: '#1b1c1b',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 18,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
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
          tabBarIcon: renderTabIcon(Home),
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarLabel: 'Markets',
          tabBarIcon: renderTabIcon(MapPinned),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarLabel: 'Products',
          tabBarIcon: renderTabIcon(Tag),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Videos',
          tabBarLabel: 'Videos',
          tabBarIcon: renderTabIcon(Video),
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
          tabBarIcon: renderTabIcon(ReceiptText),
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
          tabBarIcon: renderTabIcon(RoleIcon),
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
          tabBarIcon: renderTabIcon(UserCircle),
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

const styles = StyleSheet.create({
  tabIconWrap: {
    width: 38,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primaryMid,
  },
});
