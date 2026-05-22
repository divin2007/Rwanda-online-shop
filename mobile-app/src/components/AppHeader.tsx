import { useRouter } from 'expo-router';
import { Bell, Camera, Search, ShoppingCart } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, shadow } from '../theme';
import { useCart } from '../context/CartContext';

// ─────────────────────────────────────────────────────────────────────────────
// Alibaba-style global header: Logo | Search bar | Cart | Bell
// ─────────────────────────────────────────────────────────────────────────────
export function AppHeaderSearch() {
  const router = useRouter();
  const { totalQuantity } = useCart();
  const [query, setQuery] = useState('');

  const submit = () => {
    const trimmed = query.trim();
    if (trimmed) {
      router.push({ pathname: '/products', params: { search: trimmed } } as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Brand logo */}
      <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.8} style={styles.logoBtn}>
        <Text style={styles.logo}>RMF</Text>
        <View style={styles.logoDot} />
      </TouchableOpacity>

      {/* Search bar — Alibaba-style orange-bordered pill */}
      <View style={styles.searchWrap}>
        <Search color={colors.primary} size={15} strokeWidth={2.5} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search products, markets, sellers..."
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity onPress={() => router.push('/products' as any)} activeOpacity={0.8}>
          <Camera color={colors.muted} size={15} />
        </TouchableOpacity>
      </View>

      {/* Cart icon with badge */}
      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/cart' as any)} activeOpacity={0.8}>
        <ShoppingCart color={colors.card} size={18} strokeWidth={2} />
        {totalQuantity > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalQuantity > 99 ? '99+' : totalQuantity}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notifications */}
      <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
        <Bell color={colors.card} size={18} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple title header for inner screens (Orders, Cart, Account, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export function SimpleHeader({ title, showBack = false }: { title: string; showBack?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.simpleHeader}>
      {showBack && (
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.simpleTitle}>{title}</Text>
    </View>
  );
}

const STATUSBAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingRight: 4,
  },

  // Logo
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingRight: 2,
  },
  logo: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  logoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginBottom: 3,
  },

  // Search
  searchWrap: {
    width: '65%',
    flexBasis: '65%',
    maxWidth: '65%',
    flexGrow: 0,
    flexShrink: 1,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 0,
  },

  // Icons
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: {
    color: '#1A1A1A',
    fontSize: 8,
    fontWeight: '900',
  },

  // Simple header
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    color: colors.card,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  simpleTitle: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '700',
  },
});
