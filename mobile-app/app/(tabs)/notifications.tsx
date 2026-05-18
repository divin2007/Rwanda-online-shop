import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, Sparkles, Truck, CheckCircle2 } from 'lucide-react-native';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: '1',
      title: 'Payment Confirmed',
      body: 'MTN MoMo transaction for 25,000 RWF has been successfully processed.',
      time: 'Just now',
      type: 'payment',
      read: false
    },
    {
      id: '2',
      title: 'Rider Dispatched',
      body: 'Express Rider Jean Pierre has picked up your package RA 404 B.',
      time: '15 minutes ago',
      type: 'delivery',
      read: false
    },
    {
      id: '3',
      title: 'Verified Stall Approved',
      body: 'Murekatete Stall has confirmed your order. Items are ready for packing.',
      time: '1 hour ago',
      type: 'stall',
      read: true
    }
  ]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <CheckCircle2 color="#ff6b00" size={18} />;
      case 'delivery':
        return <Truck color="#ff6b00" size={18} />;
      default:
        return <Sparkles color="#ff6b00" size={18} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Alerts</Text>
        <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.8}>
          <Text style={styles.markReadBtn}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Bell color="#8e9e95" size={48} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyDesc}>New transactional notifications will appear here instantly.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map(item => (
              <View key={item.id} style={[styles.card, !item.read && styles.cardUnread]}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrapper}>
                    {getIcon(item.type)}
                  </View>
                  <View style={styles.meta}>
                    <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                  </View>
                  {!item.read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcf9f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  markReadBtn: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ff6b00',
  },
  scrollContent: {
    padding: 20,
  },
  emptyBox: {
    marginTop: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  emptyDesc: {
    fontSize: 11,
    color: '#8e9e95',
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  cardUnread: {
    borderColor: '#ff6b00',
    backgroundColor: '#fff7ed',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fcf9f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  meta: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  titleUnread: {
    color: '#1b1c1c',
  },
  time: {
    fontSize: 9,
    color: '#8e9e95',
    fontWeight: '600',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b00',
  },
  body: {
    fontSize: 12,
    color: '#414844',
    lineHeight: 16,
    fontWeight: '550',
    paddingLeft: 44,
  },
});
