/**
 * Rider pending-approval wall.
 * Shown after rider submits documents. Polls /riders/me every 30 s.
 * If approved → replaces to main app. Allows logout.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, LogOut, XCircle, FileText, Search, Rocket, UserCheck } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';

const ORANGE = '#FF6B00';
const CARD = '#FFFFFF';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const GREEN = '#15803D';
const RED = '#DC2626';

export default function RiderPendingScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [checking, setChecking] = useState(false);

  const checkApproval = async () => {
    setChecking(true);
    try {
      const res = await api.get<any>('rider', '/riders/me');
      const rider = (res as any)?.data || res;
      if (rider?.isApproved === true) {
        setStatus('approved');
        setTimeout(() => router.replace('/'), 1800);
      } else if (rider?.rejectedAt) {
        setStatus('rejected');
        setRejectionReason(rider.rejectionReason || 'Application declined. Contact support.');
      }
    } catch {
      // Profile not found yet — still pending
    } finally {
      setChecking(false);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    checkApproval();
    const interval = setInterval(checkApproval, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={s.root}>
      <View style={s.card}>
        {status === 'pending' && (
          <>
            <View style={s.iconCircle}>
              <Clock color={ORANGE} size={36} />
            </View>
            <Text style={s.title}>Application submitted</Text>
            <Text style={s.body}>
              Our team is reviewing your documents. This usually takes less than 24 hours.
              You'll be notified once approved.
            </Text>
            <View style={s.stepsBox}>
              <StepRow done icon={<UserCheck color={GREEN} size={16} />} text="Account created" />
              <StepRow done icon={<FileText color={GREEN} size={16} />} text="Documents submitted" />
              <StepRow icon={<Search color={ORANGE} size={16} />} text="Admin verification (in progress)" />
              <StepRow icon={<Rocket color={MUTED} size={16} />} text="Account activated" />
            </View>
            <TouchableOpacity style={s.checkBtn} onPress={checkApproval} disabled={checking} activeOpacity={0.85}>
              {checking ? (
                <ActivityIndicator color={ORANGE} size="small" />
              ) : (
                <Text style={s.checkBtnText}>Check status now</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {status === 'approved' && (
          <>
            <View style={[s.iconCircle, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle2 color={GREEN} size={36} />
            </View>
            <Text style={s.title}>You're approved!</Text>
            <Text style={s.body}>Welcome to the RMF rider team. Redirecting you now…</Text>
            <ActivityIndicator color={ORANGE} style={{ marginTop: 16 }} />
          </>
        )}

        {status === 'rejected' && (
          <>
            <View style={[s.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <XCircle color={RED} size={36} />
            </View>
            <Text style={s.title}>Application not approved</Text>
            <Text style={s.body}>{rejectionReason}</Text>
            <TouchableOpacity
              style={[s.checkBtn, { borderColor: ORANGE, backgroundColor: '#FFF3EB' }]}
              onPress={() => router.replace('/(auth)/rider-onboarding')}
              activeOpacity={0.85}
            >
              <Text style={[s.checkBtnText, { color: ORANGE }]}>Resubmit documents</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={() => logout()} activeOpacity={0.85}>
          <LogOut color={MUTED} size={16} />
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StepRow({ done = false, icon, text }: { done?: boolean; icon: React.ReactNode; text: string }) {
  return (
    <View style={sr.row}>
      <View style={sr.iconContainer}>{icon}</View>
      <Text style={[sr.text, done && sr.textDone]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: CARD, borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: LINE,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: '#FFF3EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: { color: INK, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  body: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '500' },
  stepsBox: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 12,
    padding: 14, gap: 10, borderWidth: 1, borderColor: LINE,
  },
  checkBtn: {
    width: '100%', height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: LINE,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtnText: { color: INK, fontSize: 14, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  logoutText: { color: MUTED, fontSize: 13, fontWeight: '600' },
});

const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconContainer: { width: 20, alignItems: 'center', justifyContent: 'center' },
  text: { color: MUTED, fontSize: 13, fontWeight: '600', flex: 1 },
  textDone: { color: GREEN, fontWeight: '700' },
});
