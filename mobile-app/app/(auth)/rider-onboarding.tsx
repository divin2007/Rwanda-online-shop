/**
 * Rider Onboarding — step after registering with role=RIDER
 * Collects: vehicle type, plate, ID card, licence, vehicle photo, insurance
 * Uploads docs to rider-service, then routes to pending-approval wall.
 */
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, CheckCircle2, ChevronDown, FileText, Truck } from 'lucide-react-native';
import { FastImage } from '../../src/components/FastImage';
import { api } from '../../src/lib/api';

const ORANGE = '#FF6B00';
const ORANGE_DARK = '#E05300';
const ORANGE_SOFT = '#FFF3EB';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const CARD = '#FFFFFF';
const GREEN = '#15803D';
const GREEN_SOFT = '#F0FDF4';

const VEHICLE_TYPES = ['MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN', 'TRUCK'];

type DocKey = 'idCardUrl' | 'licenseUrl' | 'vehiclePhotoUrl' | 'insuranceUrl';

const DOC_LABELS: Record<DocKey, string> = {
  idCardUrl: 'National ID card',
  licenseUrl: 'Driver\'s licence',
  vehiclePhotoUrl: 'Vehicle photo',
  insuranceUrl: 'Insurance certificate',
};

export default function RiderOnboardingScreen() {
  const router = useRouter();

  const [vehicleType, setVehicleType] = useState('MOTORCYCLE');
  const [plateNumber, setPlateNumber] = useState('');
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [uploading, setUploading] = useState<Partial<Record<DocKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const pickAndUpload = async (key: DocKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload your documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(u => ({ ...u, [key]: true }));
    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: `${key}-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      const res = await api.post<{ url: string }>('rider', '/riders/upload-document', form, { formData: true });
      const url = (res as any)?.data?.url || (res as any)?.url;
      if (!url) throw new Error('No URL returned from server');
      setDocs(d => ({ ...d, [key]: url }));
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not upload document. Try again.');
    } finally {
      setUploading(u => ({ ...u, [key]: false }));
    }
  };

  const allDocsUploaded = (Object.keys(DOC_LABELS) as DocKey[]).every(k => !!docs[k]);
  const canSubmit = vehicleType && plateNumber.trim().length >= 3 && allDocsUploaded;

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing info', 'Please fill all fields and upload all required documents.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('rider', '/riders/register', {
        vehicleType,
        plateNumber: plateNumber.trim().toUpperCase(),
        ...docs,
      });
      // Route to pending wall — do not allow rider to skip this
      router.replace('/(auth)/rider-pending' as any);
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      if (msg.toLowerCase().includes('already exists')) {
        // Profile already created — go to pending wall
        router.replace('/(auth)/rider-pending' as any);
      } else {
        Alert.alert('Could not register', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={CARD} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Truck color={CARD} size={28} />
          </View>
        </View>
        <Text style={s.heading}>Rider application</Text>
        <Text style={s.sub}>
          Complete your profile so our team can verify you. Once approved you can accept deliveries.
        </Text>

        {/* Steps indicator */}
        <View style={s.stepsRow}>
          {['Account', 'Documents', 'Review'].map((step, i) => (
            <View key={step} style={s.stepItem}>
              <View style={[s.stepDot, i <= 1 && s.stepDotActive]}>
                {i < 1 ? <CheckCircle2 color={CARD} size={12} /> : <Text style={s.stepNum}>{i + 1}</Text>}
              </View>
              <Text style={[s.stepLabel, i <= 1 && s.stepLabelActive]}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Vehicle type */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Vehicle details</Text>
          <View style={s.card}>
            <TouchableOpacity
              style={s.fieldWrap}
              onPress={() => setShowVehiclePicker(p => !p)}
              activeOpacity={0.85}
            >
              <Text style={s.label}>Vehicle type</Text>
              <View style={s.selectRow}>
                <Text style={s.selectValue}>{vehicleType}</Text>
                <ChevronDown color={MUTED} size={16} />
              </View>
            </TouchableOpacity>
            {showVehiclePicker && (
              <View style={s.picker}>
                {VEHICLE_TYPES.map(vt => (
                  <TouchableOpacity
                    key={vt}
                    style={[s.pickerItem, vt === vehicleType && s.pickerItemActive]}
                    onPress={() => { setVehicleType(vt); setShowVehiclePicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.pickerItemText, vt === vehicleType && s.pickerItemTextActive]}>{vt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[s.fieldWrap, s.dividerTop]}>
              <Text style={s.label}>Plate number</Text>
              <TextInput
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="e.g. RAC 123A"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                style={s.input}
              />
            </View>
          </View>
        </View>

        {/* Document uploads */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Required documents</Text>
          <Text style={s.sectionSub}>Clear photos or PDFs. Max 8 MB each.</Text>
          {(Object.keys(DOC_LABELS) as DocKey[]).map(key => {
            const uploaded = !!docs[key];
            const isUploading = !!uploading[key];
            return (
              <TouchableOpacity
                key={key}
                style={[s.docRow, uploaded && s.docRowDone]}
                onPress={() => pickAndUpload(key)}
                activeOpacity={0.85}
                disabled={isUploading}
              >
                <View style={[s.docThumb, uploaded && s.docThumbDone]}>
                  {uploaded ? (
                    <FastImage uri={docs[key]!} style={StyleSheet.absoluteFillObject} />
                  ) : (
                    <FileText color={uploaded ? GREEN : MUTED} size={20} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.docLabel, uploaded && s.docLabelDone]}>{DOC_LABELS[key]}</Text>
                  <Text style={s.docSub}>
                    {isUploading ? 'Uploading…' : uploaded ? 'Uploaded ✓' : 'Tap to upload'}
                  </Text>
                </View>
                {!uploaded && (
                  <Camera color={ORANGE} size={18} />
                )}
                {uploaded && (
                  <CheckCircle2 color={GREEN} size={18} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notice */}
        <View style={s.notice}>
          <Text style={s.noticeText}>
            🔒 Your documents are only seen by RMF admin staff for verification. Your account will be active within 24 hours of approval.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.primaryBtn, !canSubmit && s.primaryBtnDisabled]}
          onPress={submit}
          disabled={submitting || !canSubmit}
          activeOpacity={0.88}
        >
          <Text style={s.primaryBtnText}>{submitting ? 'Submitting…' : 'Submit application'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 36, gap: 16, paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: 4 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  heading: { color: INK, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  sub: { color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  stepsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: LINE, alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: ORANGE },
  stepNum: { color: CARD, fontSize: 12, fontWeight: '900' },
  stepLabel: { color: MUTED, fontSize: 11, fontWeight: '600' },
  stepLabelActive: { color: ORANGE_DARK, fontWeight: '800' },
  section: { gap: 10 },
  sectionTitle: { color: INK, fontSize: 15, fontWeight: '800' },
  sectionSub: { color: MUTED, fontSize: 13, fontWeight: '500', marginTop: -4 },
  card: {
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldWrap: { paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  dividerTop: { borderTopWidth: 1, borderTopColor: LINE },
  label: { color: INK, fontSize: 12, fontWeight: '700' },
  input: { color: INK, fontSize: 15, fontWeight: '600', height: 28, paddingVertical: 0 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: INK, fontSize: 15, fontWeight: '600' },
  picker: { borderTopWidth: 1, borderTopColor: LINE },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12 },
  pickerItemActive: { backgroundColor: ORANGE_SOFT },
  pickerItemText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  pickerItemTextActive: { color: ORANGE_DARK, fontWeight: '800' },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: LINE,
  },
  docRowDone: { borderColor: '#BBF7D0', backgroundColor: GREEN_SOFT },
  docThumb: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  docThumbDone: { backgroundColor: '#DCFCE7' },
  docLabel: { color: INK, fontSize: 14, fontWeight: '700' },
  docLabelDone: { color: GREEN },
  docSub: { color: MUTED, fontSize: 12, fontWeight: '500', marginTop: 2 },
  notice: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  noticeText: { color: '#1E40AF', fontSize: 13, fontWeight: '500', lineHeight: 19 },
  primaryBtn: {
    height: 54, borderRadius: 14, backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  primaryBtnText: { color: CARD, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
});
