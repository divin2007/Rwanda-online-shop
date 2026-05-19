import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, Video } from 'lucide-react-native';
import { SellerVideoFeed } from '../src/components/SellerVideoFeed';
import { colors } from '../src/theme';

export default function VideosScreen() {
  const [search, setSearch] = React.useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.pill}>
          <Video color={colors.orangeDark} size={14} />
          <Text style={styles.pillText}>Seller videos</Text>
        </View>
        <Text style={styles.title}>Watch shops explain products before you order.</Text>
        <Text style={styles.body}>Scroll shop adverts and product demos across live RMF markets. Likes and comments also tune your recommendations.</Text>
        <View style={styles.search}>
          <Search color={colors.orangeDark} size={17} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search pants, cosmetics, market..."
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
          />
        </View>
      </View>
      <SellerVideoFeed search={search} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 34, gap: 16 },
  hero: { borderRadius: 16, backgroundColor: colors.orangeDark, padding: 18, gap: 12 },
  pill: { alignSelf: 'flex-start', height: 28, borderRadius: 8, backgroundColor: colors.orangeSoft, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.card, fontSize: 27, lineHeight: 32, fontWeight: '900' },
  body: { color: '#ffedd5', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  search: { height: 48, borderRadius: 12, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '800' },
});
