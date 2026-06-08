import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { colors } from '../../src/theme';

type PlacementFilter = undefined | 'PRODUCT_AD' | 'SHOP_AD';

const VIDEO_FILTERS: Array<{ label: string; search: string; placement?: PlacementFilter }> = [
  { label: 'All', search: '' },
  { label: 'Products', search: '', placement: 'PRODUCT_AD' },
  { label: 'Shops', search: '', placement: 'SHOP_AD' },
  { label: 'Deals', search: 'deal' },
  { label: 'Groceries', search: 'grocery' },
  { label: 'Markets', search: 'market' },
];

export default function VideosScreen() {
  const [search, setSearch] = useState('');
  const [placement, setPlacement] = useState<PlacementFilter>(undefined);
  const [activeFilter, setActiveFilter] = useState('All');

  const applyFilter = (filter: typeof VIDEO_FILTERS[number]) => {
    setActiveFilter(filter.label);
    setPlacement(filter.placement);
    setSearch(filter.search);
  };

  const clearSearch = () => {
    setSearch('');
    setPlacement(undefined);
    setActiveFilter('All');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <SellerVideoFeed
        search={search}
        placement={placement}
        onTagClick={(tag) => {
          setSearch(tag.startsWith('#') ? tag : `#${tag}`);
          setPlacement(undefined);
          setActiveFilter('Tag');
        }}
        fullScreen
      />

      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>RMF</Text>
          <Text style={styles.brandSub}>Find seller videos fast</Text>
        </View>

        <View style={styles.searchRow}>
          <Search color="rgba(255,255,255,0.76)" size={15} />
          <TextInput
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setActiveFilter(value.trim() ? 'Search' : 'All');
              if (value.trim()) setPlacement(undefined);
            }}
            placeholder="Search seller, product, hashtag..."
            placeholderTextColor="rgba(255,255,255,0.48)"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search || placement ? (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X color="rgba(255,255,255,0.86)" size={16} />
            </TouchableOpacity>
          ) : (
            <SlidersHorizontal color="rgba(255,255,255,0.72)" size={16} />
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {VIDEO_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.label}
              style={[styles.filterChip, activeFilter === filter.label && styles.filterChipActive]}
              onPress={() => applyFilter(filter)}
              activeOpacity={0.86}
            >
              <Text style={[styles.filterText, activeFilter === filter.label && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 8,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 9,
    zIndex: 10,
  },
  brandRow: { gap: 1, alignSelf: 'flex-start' },
  brand: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSub: {
    color: colors.orange,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  searchRow: {
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    height: 40,
  },
  filters: { gap: 8, paddingRight: 8 },
  filterChip: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(0,0,0,0.44)',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: colors.primaryDark },
});
