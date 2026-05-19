import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileUp, Store } from 'lucide-react-native';
import { Field, PrimaryButton } from '../../src/components/FormControls';
import { ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { api } from '../../src/lib/api';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { Market } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

type DocKey = 'businessPermitUrl' | 'rraCertificateUrl' | 'idCardUrl' | 'stallPhotoUrl';

export default function SellerOnboardingScreen() {
  const router = useRouter();
  const [marketId, setMarketId] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState<Partial<Record<DocKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refresh } = useRemote<Market[]>(
    () => api.get<Market[]>('market', '/markets?activeOnly=true', { auth: false }),
    [],
  );

  const uploadDocument = async (key: DocKey) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
    } as any);
    try {
      const result = await api.post<{ url: string }>('seller', '/sellers/upload-document', form, { formData: true });
      setDocuments(current => ({ ...current, [key]: result.url }));
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload this document.');
    }
  };

  const submit = async () => {
    if (!marketId || !name.trim()) {
      Alert.alert('Required fields', 'Choose a live market and enter your shop name.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('seller', '/sellers/onboard', {
        marketId,
        shopDetails: {
          name: name.trim(),
          tagline: tagline.trim() || undefined,
          description: description.trim() || undefined,
        },
        description: description.trim() || undefined,
        ...documents,
        agreedToTerms: true,
      });
      Alert.alert('Submitted', 'Your seller profile was sent for approval.', [
        { text: 'Open seller hub', onPress: () => router.replace('/seller') },
      ]);
    } catch (err) {
      Alert.alert('Onboarding failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;
  const markets = asArray<Market>(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Store color={colors.orange} size={24} />
        <Text style={styles.title}>Seller onboarding</Text>
        <Text style={styles.subtitle}>Every market choice and approval document is sent to RMF services.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Choose market</Text>
        <View style={styles.marketGrid}>
          {markets.map(market => (
            <TouchableOpacity key={market._id} style={[styles.marketPill, marketId === market._id && styles.marketPillActive]} onPress={() => setMarketId(market._id)}>
              <Text style={[styles.marketText, marketId === market._id && styles.marketTextActive]}>{market.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Field label="Shop name" value={name} onChangeText={setName} placeholder="Your stall or shop name" />
        <Field label="Tagline" value={tagline} onChangeText={setTagline} placeholder="Short buyer-facing tagline" />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="What do you sell?" multiline />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Verification documents</Text>
        {([
          ['businessPermitUrl', 'Business permit'],
          ['rraCertificateUrl', 'RRA certificate'],
          ['idCardUrl', 'ID card'],
          ['stallPhotoUrl', 'Stall photo'],
        ] as [DocKey, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.uploadRow} onPress={() => uploadDocument(key)}>
            <FileUp color={colors.orange} size={17} />
            <Text style={styles.uploadText}>{documents[key] ? `${label} uploaded` : `Upload ${label}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <PrimaryButton label="Submit for approval" onPress={submit} loading={submitting} disabled={!marketId || !name.trim()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 18, gap: 8 },
  title: { color: colors.card, fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  marketPill: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 9 },
  marketPillActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  marketText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  marketTextActive: { color: colors.orangeDark },
  uploadRow: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  uploadText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
});
