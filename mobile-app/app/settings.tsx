import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Field, PrimaryButton } from '../src/components/FormControls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';
import { colors } from '../src/theme';
import { useRemote } from '../src/hooks/useRemote';

export default function SettingsScreen() {
  const { isAuthenticated, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [sellerRequest, setSellerRequest] = useState({ stallName: '', tagline: '', description: '', categories: '' });
  const [riderRequest, setRiderRequest] = useState({ plateNumber: '', licenseUrl: '', vehiclePhotoUrl: '', insuranceUrl: '' });
  const { data, loading, error, refresh, setData } = useRemote<Record<string, any>>(
    () => isAuthenticated ? api.get('user', '/users/settings') : Promise.resolve({}),
    [isAuthenticated],
  );

  const setValue = (key: string, value: any) => setData({ ...(data || {}), [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.put<Record<string, any>>('user', '/users/settings', data || {});
      setData(updated);
      Alert.alert('Settings saved', 'Your RMF preferences were updated.');
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not update settings.');
    } finally {
      setSaving(false);
    }
  };

  const submitSellerReview = async () => {
    setReviewing(true);
    try {
      await api.post('seller', '/sellers/settings/change-request', {
        stallName: sellerRequest.stallName,
        description: sellerRequest.description,
        shopDetails: {
          name: sellerRequest.stallName,
          tagline: sellerRequest.tagline,
          description: sellerRequest.description,
          categories: sellerRequest.categories.split(',').map(item => item.trim()).filter(Boolean),
        },
        market: { name: sellerRequest.stallName, description: sellerRequest.description },
      });
      setSellerRequest({ stallName: '', tagline: '', description: '', categories: '' });
      Alert.alert('Sent for review', 'An admin will inspect your market settings before they go live.');
    } catch (err) {
      Alert.alert('Review failed', err instanceof Error ? err.message : 'Could not submit seller settings.');
    } finally {
      setReviewing(false);
    }
  };

  const submitRiderReview = async () => {
    setReviewing(true);
    try {
      await api.post('rider', '/riders/settings/change-request', riderRequest);
      setRiderRequest({ plateNumber: '', licenseUrl: '', vehiclePhotoUrl: '', insuranceUrl: '' });
      Alert.alert('Sent for review', 'An admin will inspect your rider settings before they go live.');
    } catch (err) {
      Alert.alert('Review failed', err instanceof Error ? err.message : 'Could not submit rider settings.');
    } finally {
      setReviewing(false);
    }
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in for settings" body="Preferences are stored on your RMF account." />;
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.panel}>
        <SettingSwitch label="In-app notifications" value={data?.inAppNotifications !== false} onValueChange={value => setValue('inAppNotifications', value)} />
        <SettingSwitch label="Email notifications" value={data?.emailNotifications !== false} onValueChange={value => setValue('emailNotifications', value)} />
        <SettingSwitch label="SMS notifications" value={Boolean(data?.smsNotifications)} onValueChange={value => setValue('smsNotifications', value)} />
        <SettingSwitch label="Share phone for active orders" value={data?.sharePhoneForOrders !== false} onValueChange={value => setValue('sharePhoneForOrders', value)} />
      </View>
      <View style={styles.panel}>
        <Field label="Preferred language" value={data?.language || ''} onChangeText={value => setValue('language', value)} placeholder="en, fr, kin" />
        <Field label="Preferred currency" value={data?.currency || ''} onChangeText={value => setValue('currency', value)} placeholder="RWF" />
        <Field label="Default MoMo phone" value={data?.momoPhone || ''} onChangeText={value => setValue('momoPhone', value)} keyboardType="phone-pad" placeholder="07XXXXXXXX" />
      </View>
      {(user?.role === 'SELLER' || user?.role === 'ADMIN') ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Seller market settings review</Text>
          <Text style={styles.panelBody}>Shop and market edits go to admin approval. The slug cannot be changed.</Text>
          <Field label="Shop / market name" value={sellerRequest.stallName} onChangeText={value => setSellerRequest(current => ({ ...current, stallName: value }))} placeholder="Kimironko Produce" />
          <Field label="Tagline" value={sellerRequest.tagline} onChangeText={value => setSellerRequest(current => ({ ...current, tagline: value }))} placeholder="Fresh local stock daily" />
          <Field label="Categories" value={sellerRequest.categories} onChangeText={value => setSellerRequest(current => ({ ...current, categories: value }))} placeholder="produce, cosmetics, crafts" />
          <Field label="Description" value={sellerRequest.description} onChangeText={value => setSellerRequest(current => ({ ...current, description: value }))} placeholder="What buyers should know" multiline />
          <PrimaryButton label="Submit seller changes" onPress={submitSellerReview} loading={reviewing} />
        </View>
      ) : null}
      {(user?.role === 'RIDER' || user?.role === 'ADMIN') ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Rider profile review</Text>
          <Text style={styles.panelBody}>Vehicle and document edits need admin approval before replacing your approved profile.</Text>
          <Field label="Plate number" value={riderRequest.plateNumber} onChangeText={value => setRiderRequest(current => ({ ...current, plateNumber: value }))} placeholder="RAA 111 C" />
          <Field label="License URL" value={riderRequest.licenseUrl} onChangeText={value => setRiderRequest(current => ({ ...current, licenseUrl: value }))} placeholder="https://..." />
          <Field label="Vehicle photo URL" value={riderRequest.vehiclePhotoUrl} onChangeText={value => setRiderRequest(current => ({ ...current, vehiclePhotoUrl: value }))} placeholder="https://..." />
          <Field label="Insurance URL" value={riderRequest.insuranceUrl} onChangeText={value => setRiderRequest(current => ({ ...current, insuranceUrl: value }))} placeholder="https://..." />
          <PrimaryButton label="Submit rider changes" onPress={submitRiderReview} loading={reviewing} />
        </View>
      ) : null}
      <PrimaryButton label="Save settings" onPress={save} loading={saving} />
    </ScrollView>
  );
}

function SettingSwitch({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.orangeSoft }} thumbColor={value ? colors.orange : colors.faint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  panelBody: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.ink, fontSize: 14, fontWeight: '800', flex: 1 },
});
