import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ShoppingCart, Bell, Store } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ff6b00',
        tabBarInactiveTintColor: '#8e9e95',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: '#012d1d',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Markets',
          tabBarLabel: 'Markets',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'My Cart',
          tabBarLabel: 'Cart',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="seller"
        options={{
          title: 'My Store',
          tabBarLabel: 'Seller',
          tabBarIcon: ({ color, size }) => <Store color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
