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
import { Search, X } from 'lucide-react-native';
import { SellerVideoFeed } from '../../src/components/SellerVideoFeed';
import { colors } from '../../src/theme';

export default function VideosScreen() {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen TikTok video feed — fills root exactly */}
      <SellerVideoFeed
        search={search}
        onTagClick={(tag) => { setSearch(`#${tag}`); setShowSearch(true); }}
        fullScreen
      />

      {/* Floating search toggle — transparent, sits on top of video */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.brandRow} pointerEvents="none">
          <Text style={styles.brand}>RMF</Text>
          <Text style={styles.brandSub}>Seller videos</Text>
        </View>

        {showSearch ? (
          <View style={styles.searchRow} pointerEvents="box-none">
            <Search color="rgba(255,255,255,0.7)" size={14} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search sellers, products..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={() => { setSearch(''); setShowSearch(false); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X color="rgba(255,255,255,0.8)" size={16} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.searchIcon}
            onPress={() => setShowSearch(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Search color="#fff" size={20} />
          </TouchableOpacity>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 10,
    // No background — fully transparent over the video
  },
  brandRow: { gap: 1 },
  brand: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  brandSub: {
    color: colors.orange,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    height: 36,
  },
});
