import React, { useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell, BellOff, CheckCheck, ChevronRight,
  Package, ReceiptText, ShieldCheck, Truck, Wallet, Zap,
} from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { NotificationLog } from '../../src/types';
import { useRemote } from '../../src/hooks/useRemote';

const TYPE_META: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
  order_placed:         { icon: ReceiptText, color: '#2563eb', bg: '#eff6ff' },
  order_confirmed:      { icon: CheckCheck, color: '#2563eb', bg: '#eff6ff' },
  order_preparing:      { icon: Package, color: '#d97706', bg: '#fffbeb' },
  order_ready:          { icon: Package, color: '#7c3aed', bg: '#f5f3ff' },
  order_picked_up:      { icon: Truck, color: '#0891b2', bg: '#ecfeff' },
  order_in_transit:     { icon: Truck, color: '#0891b2', bg: '#ecfeff' },
  order_delivered:      { icon: CheckCheck, color: '#16a34a', bg: '#f0fdf4' },
  order_cancelled:      { icon: BellOff, color: '#dc2626', bg: '#fef2f2' },
  payment_confirmed:    { icon: Wallet, color: '#16a34a', bg: '#f0fdf4' },
  wallet_credit:        { icon: Wallet, color: '#16a34a', bg: '#f0fdf4' },
  wallet_payout:        { icon: Wallet, color: colors.primary, bg: '#ffedd5' },
  dispute_opened:       { icon: ShieldCheck, color: '#dc2626', bg: '#fef2f2' },
  dispute_resolved:     { icon: ShieldCheck, color: '#16a34a', bg: '#f0fdf4' },
  delivery_assigned:    { icon: Truck, color: colors.primary, bg: '#ffedd5' },
  promo_alert:          { icon: Zap, color: '#d97706', bg: '#fffbeb' },
};

const getTypeMeta = (type?: string) => {
  const key = (type || '').toLowerCase();
  for (const [k, v] of Object.entries(TYPE_META)) {
    if (key.includes(k.replace(/_/g, ''))) return v;
  }
  return { icon: Bell, color: colors.primary, bg: '#ffedd5' };
};

const orderIdFromNotif = (n: NotificationLog): string | null => {
  return n.params?.orderId || n.params?.order_id || null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [markingAll, setMarkingAll] = useState(false);

  const { data, loading, refreshing, error, refresh } = useRemote<NotificationLog[]>(
    () => isAuthenticated
      ? api.get<NotificationLog[]>('notification', '/notifications/me?limit=50').catch(() => [])
      : Promise.resolve([]),
    [isAuthenticated],
  );

  const notifications = asArray<NotificationLog>(data);
  const unread = notifications.filter(n => !n.isRead).length;

  const markAllRead = async () => {
    if (!unread) return;
    setMarkingAll(true);
    try {
      await api.patch('notification', '/notifications/mark-all-read', {});
      refresh();
    } catch { /* silent */ }
    finally { setMarkingAll(false); }
  };

  const handleTap = async (n: NotificationLog) => {
    // Mark as read
    try { await api.patch('notification', `/notifications/${n._id}/read`, {}); } catch { /* silent */ }
    // Navigate to relevant screen
    const orderId = orderIdFromNotif(n);
    if (orderId) { router.push(`/orders/${orderId}` as any); refresh(); }
    else { refresh(); }
  };

  if (!isAuthenticated) {
    return (
      <EmptyBlock
        title="Sign in for notifications"
        body="Order alerts, delivery updates, and wallet notifications appear here."
        actionLabel="Sign in"
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }
  if (loading && !data) return <LoadingBlock label="Loading notifications..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Bell color={colors.primary} size={22} />
          <View>
            <Text style={s.headerTitle}>Notifications</Text>
            {unread > 0 && <Text style={s.headerSub}>{unread} unread</Text>}
          </View>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} activeOpacity={0.8}>
            <Text style={s.markAllText}>{markingAll ? 'Marking...' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Empty */}
      {notifications.length === 0 && (
        <EmptyBlock
          title="No notifications yet"
          body="Order updates, delivery alerts, and wallet credits will show here."
        />
      )}

      {/* Notification list */}
      {notifications.map((n, i) => {
        const meta = getTypeMeta(n.type);
        const IconComp = meta.icon;
        const isUnread = !n.isRead;
        const orderId = orderIdFromNotif(n);

        return (
          <TouchableOpacity
            key={n._id || i}
            style={[s.notifCard, isUnread && s.notifCardUnread]}
            onPress={() => handleTap(n)}
            activeOpacity={0.85}
          >
            {isUnread && <View style={s.unreadDot} />}
            <View style={[s.notifIcon, { backgroundColor: meta.bg }]}>
              <IconComp color={meta.color} size={18} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.notifTitle, isUnread && s.notifTitleUnread]} numberOfLines={2}>
                {n.title || n.type?.replace(/_/g, ' ') || 'Notification'}
              </Text>
              {(n.message || n.body) && (
                <Text style={s.notifBody} numberOfLines={3}>{n.message || n.body}</Text>
              )}
              <Text style={s.notifTime}>{formatDateTime(n.createdAt)}</Text>
            </View>
            {orderId && <ChevronRight color="#c0b8b0" size={15} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 14, gap: 8, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#17201a' },
  headerSub: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 1 },
  markAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  notifCardUnread: { backgroundColor: '#fffcf9', borderLeftWidth: 3, borderLeftColor: colors.primary },
  unreadDot: { position: 'absolute', top: 12, left: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
  notifIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#17201a', lineHeight: 20 },
  notifTitleUnread: { fontWeight: '800' },
  notifBody: { fontSize: 13, color: '#574e47', lineHeight: 19 },
  notifTime: { fontSize: 11, color: '#a89b91', marginTop: 2 },
});
