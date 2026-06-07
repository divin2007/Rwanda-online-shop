import React, { useState } from 'react';
import {
  Alert, Dimensions, RefreshControl, ScrollView,
  Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Download, QrCode, RefreshCw, Share2, Store } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';
import { SellerProfile } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

const { width: W } = Dimensions.get('window');
const QR_SIZE = Math.min(W - 80, 260);

// Builds a self-contained QR code HTML using the qrcode.js library
const buildQrHtml = (value: string, size: number) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html,body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;background:#fff;height:100%;}
  canvas{display:block;}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head><body>
<div id="qr"></div>
<script>
  new QRCode(document.getElementById("qr"),{
    text: ${JSON.stringify(value)},
    width: ${size},
    height: ${size},
    colorDark: "#17201a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
</script>
</body></html>`;

export default function SellerQrScreen() {
  const { user, isAuthenticated } = useAuth();

  const { data: seller, loading, refreshing, error, refresh } = useRemote<SellerProfile | null>(
    () => isAuthenticated ? api.get<SellerProfile | null>('seller', '/sellers/me').catch(() => null) : Promise.resolve(null),
    [isAuthenticated],
  );

  const stallId = seller?.stallId || '';
  const shopName = seller?.shopDetails?.name || seller?.stallName || user?.fullName || 'My Stall';
  const marketName = typeof seller?.marketId === 'object' ? (seller.marketId as any)?.name : undefined;

  // Deep-link value: buyer scans → opens stall in the app
  const qrValue = stallId
    ? `https://rwshop.org/seller/${stallId}`
    : `https://rwshop.org/seller/${user?.id || ''}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Visit my RMF store "${shopName}"${marketName ? ` at ${marketName}` : ''}!\n\n${qrValue}`,
        url: qrValue,
        title: `${shopName} — RMF Store`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not open the share sheet.');
    }
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Your stall QR code is available after onboarding." />;
  if (loading && !seller) return <LoadingBlock label="Loading your stall..." />;
  if (error && !seller) return <ErrorBlock message={error} onRetry={refresh} />;

  if (!stallId && !seller) {
    return (
      <EmptyBlock
        title="No stall found"
        body="Complete seller onboarding to get your stall QR code."
        actionLabel="Start onboarding"
      />
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerIcon}><QrCode color="#fff" size={24} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Stall QR Code</Text>
          <Text style={s.headerSub}>Buyers scan this to visit your store instantly</Text>
        </View>
      </View>

      {/* Store info */}
      <View style={s.infoCard}>
        <View style={s.storeRow}>
          <View style={s.storeIcon}><Store color={colors.primary} size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.storeName}>{shopName}</Text>
            {marketName && <Text style={s.storeMeta}>{marketName}</Text>}
            {stallId && <Text style={s.stallId}>Stall ID: {stallId}</Text>}
          </View>
        </View>
        {seller?.isApproved ? (
          <View style={s.approvedBadge}><Text style={s.approvedText}>✓ Verified Seller</Text></View>
        ) : (
          <View style={s.pendingBadge}><Text style={s.pendingText}>⏳ Approval pending</Text></View>
        )}
      </View>

      {/* QR Code */}
      <View style={s.qrCard}>
        <View style={s.qrFrame}>
          {/* Corner decorations */}
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
          <WebView
            source={{ html: buildQrHtml(qrValue, QR_SIZE - 24) }}
            style={{ width: QR_SIZE, height: QR_SIZE }}
            scrollEnabled={false}
            scalesPageToFit={false}
            originWhitelist={['*']}
            javaScriptEnabled
          />
        </View>
        <Text style={s.qrCaption}>Scan with any camera to open {shopName}</Text>
        <Text style={s.qrUrl} numberOfLines={2}>{qrValue}</Text>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={s.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
          <Share2 color="#fff" size={18} />
          <Text style={s.primaryBtnText}>Share store link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} onPress={refresh} activeOpacity={0.85}>
          <RefreshCw color={colors.primary} size={16} />
          <Text style={s.secondaryBtnText}>Refresh QR</Text>
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={s.tipsCard}>
        <Text style={s.tipsTitle}>💡 Tips</Text>
        <Text style={s.tipItem}>• Print and display this QR code at your physical stall</Text>
        <Text style={s.tipItem}>• Share the link on WhatsApp, Facebook, or Instagram</Text>
        <Text style={s.tipItem}>• Buyers scan to browse your products and place orders</Text>
        <Text style={s.tipItem}>• Orders come with escrow protection for both parties</Text>
      </View>
    </ScrollView>
  );
}

const C = colors.primary;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 14, paddingBottom: 48, alignItems: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C, borderRadius: 16, padding: 20, shadowColor: C, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  headerIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, lineHeight: 17 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ffedd5', alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 16, fontWeight: '800', color: '#17201a' },
  storeMeta: { fontSize: 12, color: '#80756c', marginTop: 2 },
  stallId: { fontSize: 11, color: '#a89b91', marginTop: 2, fontFamily: 'monospace' },
  approvedBadge: { alignSelf: 'flex-start', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  approvedText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  pendingBadge: { alignSelf: 'flex-start', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  pendingText: { color: '#d97706', fontSize: 12, fontWeight: '700' },
  qrCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  qrFrame: { position: 'relative', padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: C, zIndex: 2 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  qrCaption: { fontSize: 14, fontWeight: '600', color: '#17201a', textAlign: 'center' },
  qrUrl: { fontSize: 11, color: '#80756c', textAlign: 'center', lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  primaryBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: C, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { height: 50, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: C, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff' },
  secondaryBtnText: { color: C, fontSize: 14, fontWeight: '700' },
  tipsCard: { backgroundColor: '#ffedd5', borderRadius: 16, padding: 16, gap: 8 },
  tipsTitle: { fontSize: 14, fontWeight: '800', color: '#17201a' },
  tipItem: { fontSize: 13, color: '#574e47', lineHeight: 20 },
});
