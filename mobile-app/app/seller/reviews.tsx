import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MessageSquare, Star, TrendingUp, ThumbsUp } from 'lucide-react-native';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../src/components/StateView';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { formatDateTime } from '../../src/lib/format';
import { asArray } from '../../src/lib/normalize';
import { colors } from '../../src/theme';
import { useRemote } from '../../src/hooks/useRemote';

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  productId?: string | { name?: string };
  sellerId?: string;
  buyer?: { fullName?: string };
  type?: 'product' | 'seller';
};

const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={size} color={colors.gold} fill={i <= Math.round(rating) ? colors.gold : 'transparent'} strokeWidth={1.5} />
    ))}
  </View>
);

export default function SellerReviewsScreen() {
  const { user, isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '1-2'>('all');

  const { data, loading, refreshing, error, refresh } = useRemote<Review[]>(
    () => isAuthenticated && user
      ? api.get<Review[]>('review', `/reviews?sellerId=${encodeURIComponent(user.id)}&limit=100`).catch(() => [])
      : Promise.resolve([]),
    [isAuthenticated, user?.id],
  );

  const reviews = asArray<Review>(data);

  const stats = useMemo(() => {
    if (!reviews.length) return { avg: 0, dist: {} as Record<number, number> };
    const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => { const star = Math.round(r.rating || 0); if (dist[star] !== undefined) dist[star]++; });
    return { avg, dist };
  }, [reviews]);

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews;
    if (filter === '5') return reviews.filter(r => Math.round(r.rating) === 5);
    if (filter === '4') return reviews.filter(r => Math.round(r.rating) === 4);
    if (filter === '3') return reviews.filter(r => Math.round(r.rating) === 3);
    return reviews.filter(r => Math.round(r.rating) <= 2);
  }, [reviews, filter]);

  if (!isAuthenticated) return <EmptyBlock title="Sign in required" body="Reviews are attached to your seller account." />;
  if (loading && !data) return <LoadingBlock label="Loading your reviews..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>

      {/* Rating overview */}
      <View style={s.overviewCard}>
        <View style={s.overviewLeft}>
          <Text style={s.bigRating}>{stats.avg > 0 ? stats.avg.toFixed(1) : '—'}</Text>
          <Stars rating={stats.avg} size={18} />
          <Text style={s.reviewCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.overviewRight}>
          {[5,4,3,2,1].map(star => {
            const count = stats.dist[star] || 0;
            const pct = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <View key={star} style={s.distRow}>
                <Text style={s.distStar}>{star}</Text>
                <Star size={10} color={colors.gold} fill={colors.gold} />
                <View style={s.distBarWrap}><View style={[s.distBar, { width: `${pct}%` }]} /></View>
                <Text style={s.distCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {(['all','5','4','3','1-2'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)} activeOpacity={0.8}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>
              {f === 'all' ? 'All' : f === '1-2' ? '1-2 ★' : `${f} ★`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Reviews list */}
      {filtered.length === 0 ? (
        <EmptyBlock
          title="No reviews yet"
          body={reviews.length ? 'No reviews match this filter.' : 'Customers will leave reviews after receiving their orders.'}
        />
      ) : (
        filtered.map(review => {
          const productName = typeof review.productId === 'object' ? review.productId?.name : undefined;
          const buyerName = review.buyer?.fullName || 'Anonymous buyer';
          return (
            <View key={review._id} style={s.reviewCard}>
              <View style={s.reviewHeader}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{buyerName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.buyerName}>{buyerName}</Text>
                  <Text style={s.reviewDate}>{formatDateTime(review.createdAt)}</Text>
                </View>
                <Stars rating={review.rating} size={13} />
              </View>
              {productName && (
                <View style={s.productTag}>
                  <Text style={s.productTagText}>{productName}</Text>
                </View>
              )}
              {review.comment ? (
                <Text style={s.comment}>"{review.comment}"</Text>
              ) : (
                <Text style={s.noComment}>No written comment</Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  overviewCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  overviewLeft: { alignItems: 'center', gap: 6, width: 90 },
  bigRating: { color: '#fff', fontSize: 48, fontWeight: '900', lineHeight: 52 },
  reviewCount: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  overviewRight: { flex: 1, gap: 6 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  distStar: { color: '#fff', fontSize: 12, fontWeight: '700', width: 10, textAlign: 'right' },
  distBarWrap: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  distBar: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  distCount: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', width: 20, textAlign: 'right' },
  chips: { gap: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#ebdcd0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: '#80756c' },
  chipTextActive: { color: '#fff' },
  reviewCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  buyerName: { fontSize: 14, fontWeight: '700', color: '#17201a' },
  reviewDate: { fontSize: 11, color: '#80756c', marginTop: 1 },
  productTag: { alignSelf: 'flex-start', backgroundColor: '#f0f7ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  productTagText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  comment: { fontSize: 14, color: '#574e47', lineHeight: 22, fontStyle: 'italic' },
  noComment: { fontSize: 12, color: '#a89b91', fontStyle: 'italic' },
});
