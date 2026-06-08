import { useRouter } from 'expo-router';
import { Bell, MapPin, Search, ShoppingCart } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { useCart } from '../context/CartContext';

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
      <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.8} style={styles.logoBtn}>
        <MapPin color={colors.primary} size={18} strokeWidth={2.6} />
        <Text style={styles.logo}>RMF</Text>
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <Search color={colors.body} size={15} strokeWidth={2.4} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search RMF Marketplace..."
          placeholderTextColor="#737987"
          returnKeyType="search"
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
      </View>

      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/cart' as any)} activeOpacity={0.8}>
        <ShoppingCart color={colors.primary} size={18} strokeWidth={2.2} />
        {totalQuantity > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalQuantity > 99 ? '99+' : totalQuantity}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
        <Bell color={colors.primary} size={18} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingRight: 4,
  },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  searchWrap: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {
    color: colors.card,
    fontSize: 8,
    fontWeight: '900',
  },
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
    color: colors.primary,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  simpleTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
});
