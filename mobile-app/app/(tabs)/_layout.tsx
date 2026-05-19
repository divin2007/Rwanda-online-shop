import React from 'react';
import { Tabs } from 'expo-router';
import { Bike, BriefcaseBusiness, Home, MapPinned, ReceiptText, ShieldCheck, ShoppingCart, UserCircle } from 'lucide-react-native';
import { AppHeaderSearch } from '../../src/components/AppHeader';
import { colors } from '../../src/theme';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const { totalQuantity } = useCart();
  const { user, isAuthenticated } = useAuth();
  const roleLabel = user?.role === 'SELLER' ? 'Seller' : user?.role === 'RIDER' ? 'Rider' : user?.role === 'ADMIN' ? 'Admin' : 'Buyer';
  const RoleIcon = user?.role === 'RIDER' ? Bike : user?.role === 'SELLER' || user?.role === 'ADMIN' ? BriefcaseBusiness : ShieldCheck;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.ink,
        headerTitle: () => <AppHeaderSearch />,
        headerTitleAlign: 'left',
        headerTitleContainerStyle: { left: 16, right: 10 },
        headerShadowVisible: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'RMF',
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarLabel: 'Markets',
          tabBarIcon: ({ color, size }) => <MapPinned color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarLabel: 'Cart',
          tabBarBadge: totalQuantity > 0 ? totalQuantity : undefined,
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="seller"
        options={{
          title: roleLabel,
          tabBarLabel: roleLabel,
          href: isAuthenticated ? '/seller' : null,
          tabBarIcon: ({ color, size }) => <RoleIcon color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
