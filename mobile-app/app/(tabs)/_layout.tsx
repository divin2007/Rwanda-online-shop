import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import {
  Bike, BriefcaseBusiness, Compass, Home, Mail,
  ReceiptText, UserCircle,
} from 'lucide-react-native';
import { AppHeaderSearch } from '../../src/components/AppHeader';
import { colors } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Solaris Ivory Tab Layout
// Five primary tabs matching the Stitch mobile reference.
// Role-specific workspaces stay reachable from Profile.
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
        // Solaris Ivory header.
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

        // Stitch-style bottom navigation.
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
          href: null,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Discover',
          tabBarLabel: 'Discover',
          tabBarIcon: renderTabIcon(Compass),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Videos',
          href: null,
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          // Checkout uses a centered title.
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: 'Secure Checkout',
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
          title: 'Inbox',
          tabBarLabel: 'Inbox',
          tabBarIcon: renderTabIcon(Mail),
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
          headerTitle: 'Orders',
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
          href: null,
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
          tabBarLabel: 'Profile',
          tabBarIcon: renderTabIcon(UserCircle),
          headerStyle: { backgroundColor: colors.card, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.ink,
          headerTitle: 'Profile',
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
