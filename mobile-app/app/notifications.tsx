import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, CheckCircle2 } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../src/components/StateView';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';
import { formatDateTime } from '../src/lib/format';
import { asArray } from '../src/lib/normalize';
import { colors } from '../src/theme';
import { NotificationLog } from '../src/types';
import { useRemote } from '../src/hooks/useRemote';

export default function NotificationsScreen() {
  const { isAuthenticated } = useAuth();
  const { data, loading, refreshing, error, refresh, setData } = useRemote<NotificationLog[]>(
    () => isAuthenticated ? api.get<NotificationLog[]>('notification', '/notifications/me') : Promise.resolve([]),
    [isAuthenticated],
  );

  const markRead = async (id: string) => {
    await api.put('notification', `/notifications/read/${id}`);
    setData((data || []).map(item => item._id === id ? { ...item, isRead: true } : item));
  };

  const markAll = async () => {
    await api.put('notification', '/notifications/read-all');
    setData((data || []).map(item => ({ ...item, isRead: true })));
  };

  if (!isAuthenticated) return <EmptyBlock title="Sign in for notifications" body="RMF sends order, payment, seller, and rider notifications to authenticated users." />;
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  const notifications = asArray<NotificationLog>(data);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Bell color={colors.orange} size={20} />
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={markAll}><Text style={styles.link}>Mark all read</Text></TouchableOpacity>
      </View>

      {notifications.length ? notifications.map(item => (
        <TouchableOpacity key={item._id} style={[styles.card, !item.isRead && styles.unread]} onPress={() => markRead(item._id)} activeOpacity={0.85}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{item.title || item.type || 'RMF update'}</Text>
            {item.isRead ? <CheckCircle2 color={colors.success} size={16} /> : <View style={styles.dot} />}
          </View>
          <Text style={styles.body}>{item.message || item.body || JSON.stringify(item.params || {})}</Text>
          <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
        </TouchableOpacity>
      )) : (
        <EmptyBlock title="No notifications yet" body="New order, payment, and delivery notifications will appear here." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  link: { color: colors.orangeDark, fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 7 },
  unread: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '900' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, marginTop: 5 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  time: { color: colors.faint, fontSize: 10, fontWeight: '800' },
});

