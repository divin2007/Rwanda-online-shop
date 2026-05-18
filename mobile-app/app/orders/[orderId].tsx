import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    { title: 'Payment Confirmed', desc: 'Transaction approved via MTN MoMo' },
    { title: 'Order Prepared', desc: 'Murekatete Stall is packing your items' },
    { title: 'Rider Dispatched', desc: 'Jean Pierre (Express Rider) is on the way' },
    { title: 'Delivered', desc: 'Enjoy your verified authentic products!' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex(prev => {
        if (prev < statuses.length - 1) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Top cinematic map simulator ── */}
        <View style={styles.mapContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800' }}
            style={styles.mapImg}
          />
          <View style={styles.mapOverlay} />
          
          <View style={styles.floatingHub}>
            <View style={styles.riderAvatar}>
              <Text style={styles.avatarTxt}>JP</Text>
            </View>
            <View style={styles.riderMeta}>
              <Text style={styles.riderTitle}>Jean Pierre</Text>
              <Text style={styles.riderSubtitle}>Express Rider • RA 404 B</Text>
            </View>
            <View style={styles.riderBadge}>
              <Text style={styles.riderBadgeTxt}>IN TRANSIT</Text>
            </View>
          </View>
        </View>

        {/* ── Tracking Timeline Hub ── */}
        <View style={styles.timelineCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.orderLabel}>Order Tracking</Text>
            <Text style={styles.orderIdText}>ID: #{orderId?.slice(0, 8)}</Text>
          </View>

          <View style={styles.timelineList}>
            {statuses.map((step, idx) => {
              const isDone = idx <= statusIndex;
              const isCurrent = idx === statusIndex;
              const showLine = idx < statuses.length - 1;

              return (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.indicatorCol}>
                    <View style={[
                      styles.circle,
                      isDone && styles.circleDone,
                      isCurrent && styles.circleCurrent
                    ]}>
                      {isDone && <Check color="#ffffff" size={10} />}
                    </View>
                    {showLine && (
                      <View style={[styles.line, isDone && styles.lineDone]} />
                    )}
                  </View>

                  <View style={styles.contentCol}>
                    <Text style={[
                      styles.stepTitle,
                      isDone && styles.stepTitleDone,
                      isCurrent && styles.stepTitleCurrent
                    ]}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Verified Partner Shield ── */}
        <View style={styles.guaranteeBox}>
          <ShieldCheck color="#ff6b00" size={24} />
          <View style={styles.guaranteeMeta}>
            <Text style={styles.guaranteeTitle}>Kigali Sanctuary Guarantee</Text>
            <Text style={styles.guaranteeDesc}>Fully secure payment and 100% genuine local product inspection.</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed Footer return button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.push('/')}
          activeOpacity={0.9}
        >
          <Text style={styles.homeBtnTxt}>Return to Marketplace</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcf9f8',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mapContainer: {
    height: 240,
    position: 'relative',
    backgroundColor: '#e0e0e0',
  },
  mapImg: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 45, 29, 0.15)',
  },
  floatingHub: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff6b00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#012d1d',
  },
  riderMeta: {
    flex: 1,
    marginLeft: 12,
  },
  riderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  riderSubtitle: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '600',
    marginTop: 2,
  },
  riderBadge: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riderBadgeTxt: {
    fontSize: 8,
    fontWeight: '950',
    color: '#0369a1',
    textTransform: 'uppercase',
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    margin: 20,
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
    marginBottom: 20,
  },
  orderLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff6b00',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  orderIdText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  timelineList: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 64,
  },
  indicatorCol: {
    width: 24,
    alignItems: 'center',
  },
  circle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e0e0e0',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  circleDone: {
    backgroundColor: '#ff6b00',
  },
  circleCurrent: {
    backgroundColor: '#ff6b00',
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: -2,
  },
  lineDone: {
    backgroundColor: '#ff6b00',
  },
  contentCol: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  stepTitleDone: {
    color: '#1b1c1c',
  },
  stepTitleCurrent: {
    color: '#ff6b00',
  },
  stepDesc: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 14,
  },
  guaranteeBox: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12, // Reduced rounded corners from 24 to 12
    alignItems: 'center',
    gap: 12,
  },
  guaranteeMeta: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  guaranteeDesc: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 88,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  homeBtn: {
    backgroundColor: '#ff6b00',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  homeBtnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#012d1d',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
