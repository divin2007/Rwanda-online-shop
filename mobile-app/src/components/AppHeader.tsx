import { useRouter } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

export function AppHeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const submit = () => {
    const trimmed = query.trim();
    router.push({ pathname: '/markets', params: trimmed ? { search: trimmed } : undefined } as any);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.logoWrap} onPress={() => router.push('/')} activeOpacity={0.85}>
        <Text style={styles.logo}>RMF</Text>
      </TouchableOpacity>
      <View style={styles.search}>
        <Search color={colors.orange} size={15} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search RMF"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          style={styles.input}
        />
      </View>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')} activeOpacity={0.85}>
        <Bell color={colors.orangeDark} size={18} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 520,
  },
  logoWrap: {
    height: 36,
    justifyContent: 'center',
  },
  logo: {
    color: colors.orangeDark,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
  },
  search: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 7,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
