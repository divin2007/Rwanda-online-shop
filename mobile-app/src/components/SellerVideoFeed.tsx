import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Heart, MessageCircle, Play, Send, ThumbsDown } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { asArray, imageOf, marketOf, sellerProfileOf } from '../lib/normalize';
import { colors, shadow } from '../theme';
import { SellerVideo } from '../types';

type Props = {
  marketId?: string;
  sellerId?: string;
  placement?: 'PRODUCT_AD' | 'SHOP_AD';
  compact?: boolean;
  search?: string;
};

export function SellerVideoFeed({ marketId, sellerId, placement, compact, search }: Props) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<SellerVideo[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: compact ? '8' : '24' });
    if (marketId) params.set('marketId', marketId);
    if (sellerId) params.set('sellerId', sellerId);
    if (placement) params.set('placement', placement);
    if (search?.trim()) params.set('search', search.trim());
    const result = await api.get<SellerVideo[]>('product', `/seller-videos?${params.toString()}`, { auth: false });
    setVideos(asArray<SellerVideo>(result));
  }, [compact, marketId, placement, search, sellerId]);

  useEffect(() => {
    load().catch(() => setVideos([]));
  }, [load]);

  const react = async (video: SellerVideo, reaction: 'like' | 'dislike') => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to react to seller videos.');
      return;
    }
    const nextReaction = video.viewerReaction === reaction ? 'none' : reaction;
    const updated = await api.post<SellerVideo>('product', `/seller-videos/${video._id}/reaction`, { reaction: nextReaction });
    setVideos(current => current.map(item => item._id === video._id ? updated : item));
  };

  const submitComment = async (video: SellerVideo) => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to comment on seller videos.');
      return;
    }
    const text = (comments[video._id] || '').trim();
    if (!text) return;
    const updated = await api.post<SellerVideo>('product', `/seller-videos/${video._id}/comments`, { text, fullName: user.fullName });
    setVideos(current => current.map(item => item._id === video._id ? updated : item));
    setComments(current => ({ ...current, [video._id]: '' }));
  };

  if (!videos.length) return null;

  return (
    <ScrollView horizontal={compact} pagingEnabled={!compact} showsHorizontalScrollIndicator={false} contentContainerStyle={compact ? styles.horizontal : styles.list}>
      {videos.map(video => {
        const seller = typeof video.sellerId === 'object' ? sellerProfileOf({ sellerId: video.sellerId } as any) : null;
        const product = typeof video.productId === 'object' ? video.productId : undefined;
        const market = typeof video.marketId === 'object' ? marketOf(video.marketId as any) : null;
        const poster = video.thumbnailUrl || imageOf(product);
        return (
          <View key={video._id} style={[styles.card, compact && styles.compactCard, !compact && styles.fullFeedCard]}>
            <TouchableOpacity style={styles.poster} onPress={() => Linking.openURL(video.videoUrl)} activeOpacity={0.9}>
              {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
              <View style={styles.posterOverlay}>
                <View style={styles.play}>
                  <Play color={colors.card} fill={colors.card} size={18} />
                </View>
                <Text style={styles.posterText}>{video.placement === 'SHOP_AD' ? 'Shop advert' : 'Product demo'}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>{seller?.shopDetails?.name || seller?.stallName || market?.name || 'Verified RMF seller'}</Text>
              {video.caption ? <Text style={styles.caption} numberOfLines={2}>{video.caption}</Text> : null}
              {market?.name ? <Text style={styles.product} numberOfLines={1}>{market.name}</Text> : null}
              {product ? <Text style={styles.product} numberOfLines={1}>{product.name}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.action, video.viewerReaction === 'like' && styles.actionActive]} onPress={() => react(video, 'like')}>
                  <Heart color={video.viewerReaction === 'like' ? colors.card : colors.orangeDark} size={14} />
                  <Text style={[styles.actionText, video.viewerReaction === 'like' && styles.actionTextActive]}>{video.likeCount || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.action, video.viewerReaction === 'dislike' && styles.actionDark]} onPress={() => react(video, 'dislike')}>
                  <ThumbsDown color={video.viewerReaction === 'dislike' ? colors.card : colors.orangeDark} size={14} />
                  <Text style={[styles.actionText, video.viewerReaction === 'dislike' && styles.actionTextActive]}>{video.dislikeCount || 0}</Text>
                </TouchableOpacity>
                <View style={styles.action}>
                  <MessageCircle color={colors.orangeDark} size={14} />
                  <Text style={styles.actionText}>{video.commentCount || 0}</Text>
                </View>
              </View>
              {video.comments?.slice(-1).map((comment, index) => (
                <Text key={comment._id || index} style={styles.comment} numberOfLines={2}>
                  <Text style={styles.commentName}>{comment.fullName || 'RMF user'}: </Text>{comment.text}
                </Text>
              ))}
              <View style={styles.commentRow}>
                <TextInput
                  value={comments[video._id] || ''}
                  onChangeText={text => setComments(current => ({ ...current, [video._id]: text }))}
                  placeholder="Comment..."
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
                <TouchableOpacity style={styles.send} onPress={() => submitComment(video)}>
                  <Send color={colors.card} size={14} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizontal: { paddingHorizontal: 16, gap: 12 },
  list: { gap: 14 },
  card: { width: '100%', borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden', ...shadow },
  compactCard: { width: 250 },
  fullFeedCard: { minHeight: 620 },
  poster: { height: 360, backgroundColor: colors.greenDark },
  posterOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  play: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  posterText: { color: colors.card, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  body: { padding: 12, gap: 8 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '900', lineHeight: 20 },
  meta: { color: colors.orangeDark, fontSize: 11, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  product: { color: colors.ink, fontSize: 12, fontWeight: '900', paddingTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 36, borderRadius: 9, backgroundColor: colors.orangeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionActive: { backgroundColor: colors.orange },
  actionDark: { backgroundColor: colors.greenDark },
  actionText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900' },
  actionTextActive: { color: colors.card },
  comment: { borderRadius: 9, backgroundColor: colors.paper, padding: 9, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  commentName: { color: colors.ink, fontWeight: '900' },
  commentRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, color: colors.ink, fontSize: 12, fontWeight: '700' },
  send: { width: 38, height: 38, borderRadius: 9, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
});
