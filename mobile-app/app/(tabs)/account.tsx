import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Heart, LogOut, Settings, Sparkles, UserCircle, Wallet } from 'lucide-react-native';
import { EmptyBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return <EmptyBlock title="Account required" body="Sign in to manage orders, wallet, notifications, wishlist, and settings." actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />;
  }

  const rows = [
    { label: 'Notifications', icon: Bell, route: '/notifications' },
    { label: 'Wallet', icon: Wallet, route: '/wallet' },
    { label: 'Recommendations', icon: Sparkles, route: '/preferences' },
    { label: 'Settings', icon: Settings, route: '/settings' },
    { label: 'Wishlist', icon: Heart, route: '/wishlist' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <UserCircle color={colors.orange} size={42} />
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        <View style={styles.role}><Text style={styles.roleText}>{user.role}</Text></View>
      </View>

      <View style={styles.panel}>
        {rows.map(row => {
          const Icon = row.icon;
          return (
            <TouchableOpacity key={row.label} style={styles.row} onPress={() => router.push(row.route as any)} activeOpacity={0.85}>
              <Icon color={colors.orange} size={19} />
              <Text style={styles.rowText}>{row.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.logout} onPress={() => logout()} activeOpacity={0.85}>
        <LogOut color={colors.danger} size={18} />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14 },
  hero: { backgroundColor: colors.greenDark, borderRadius: 16, padding: 20, alignItems: 'center', gap: 7 },
  name: { color: colors.card, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  meta: { color: '#ffedd5', fontSize: 12, fontWeight: '700' },
  role: { marginTop: 8, backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  logout: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});
