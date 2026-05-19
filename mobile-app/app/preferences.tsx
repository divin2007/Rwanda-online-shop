import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, MapPin, Sparkles } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { useRemote } from '../src/hooks/useRemote';
import { api } from '../src/lib/api';
import { asArray } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { CatalogCategory, Market } from '../src/types';

type PreferencePayload = {
  categories: CatalogCategory[];
  markets: Market[];
  selectedCategoryIds: string[];
  selectedMarketIds: string[];
};

const loadPreferences = async (): Promise<PreferencePayload> => {
  const [categories, markets, prefs] = await Promise.all([
    api.get<CatalogCategory[]>('product', '/products/catalog/categories', { auth: false }),
    api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    api.get<Record<string, any>>('user', '/users/preferences/discovery'),
  ]);
  return {
    categories: asArray<CatalogCategory>(categories).filter(category => category.isActive !== false),
    markets: asArray<Market>(markets),
    selectedCategoryIds: asArray<string>(prefs?.categoryIds),
    selectedMarketIds: asArray<string>(prefs?.marketIds).map(String),
  };
};

export default function PreferencesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh } = useRemote(loadPreferences, []);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [marketIds, setMarketIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (data) {
      setCategoryIds(data.selectedCategoryIds);
      setMarketIds(data.selectedMarketIds);
    }
  }, [data]);

  const categories = data?.categories || [];
  const markets = data?.markets || [];
  const selectedCount = useMemo(() => categoryIds.length + marketIds.length, [categoryIds.length, marketIds.length]);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void, max: number) => {
    setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value].slice(0, max));
  };

  const save = async () => {
    if (!categoryIds.length && !marketIds.length) {
      Alert.alert('Choose preferences', 'Pick at least one category or market.');
      return;
    }
    setSaving(true);
    try {
      await api.put('user', '/users/preferences/discovery', { categoryIds, marketIds });
      Alert.alert('Recommendations updated', 'RMF will use this plus your browsing behavior.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Create or sign in to tune your RMF recommendations." actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />;
  if (loading && !data) return <LoadingBlock label="Loading your recommendation profile..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroPill}>
          <Sparkles color={colors.orangeDark} size={14} />
          <Text style={styles.heroPillText}>For you</Text>
        </View>
        <Text style={styles.title}>Teach RMF what to recommend first.</Text>
        <Text style={styles.body}>Your choices start the feed. Product views, wishlists, carts, and seller videos keep improving it.</Text>
      </View>

      <Section title="Product categories" meta={`${categoryIds.length} selected`}>
        <View style={styles.wrap}>
          {categories.map(category => {
            const active = categoryIds.includes(category.id);
            return (
              <TouchableOpacity key={category.id} style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => toggle(category.id, categoryIds, setCategoryIds, 12)} activeOpacity={0.85}>
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
                {active ? <Check color={colors.card} size={13} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Favorite markets" meta={`${marketIds.length} selected`}>
        <View style={styles.marketList}>
          {markets.map(market => {
            const active = marketIds.includes(market._id);
            return (
              <TouchableOpacity key={market._id} style={[styles.marketRow, active && styles.marketRowActive]} onPress={() => toggle(market._id, marketIds, setMarketIds, 8)} activeOpacity={0.85}>
                <View style={styles.marketIcon}>{active ? <Check color={colors.card} size={15} /> : <MapPin color={colors.orange} size={15} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marketName}>{market.name}</Text>
                  <Text style={styles.marketMeta}>{market.location?.district || market.location?.address || 'Rwanda market'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <TouchableOpacity style={[styles.save, (!selectedCount || saving) && styles.saveDisabled]} onPress={save} disabled={!selectedCount || saving} activeOpacity={0.9}>
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save recommendation profile'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 34, gap: 16 },
  hero: { borderRadius: 16, backgroundColor: colors.orangeDark, padding: 18, gap: 12 },
  heroPill: { alignSelf: 'flex-start', height: 28, borderRadius: 8, backgroundColor: colors.orangeSoft, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroPillText: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.card, fontSize: 27, lineHeight: 32, fontWeight: '900' },
  body: { color: '#ffedd5', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  section: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 14, gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11 },
  categoryChipActive: { borderColor: colors.orange, backgroundColor: colors.orange },
  categoryText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  categoryTextActive: { color: colors.card },
  marketList: { gap: 9 },
  marketRow: { minHeight: 58, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  marketRowActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  marketIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  marketName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  marketMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  save: { height: 52, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.card, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9 },
});
