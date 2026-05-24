import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRouter } from 'expo-router';
import { Heart, MessageCircle, Play, Send, Store, ThumbsDown, X } from 'lucide-react-native';
import { FastImage } from './FastImage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { asArray, idOf, imageOf, normalizeImageUrl, normalizeMediaUrl } from '../lib/normalize';
import { colors, shadow } from '../theme';
import { Product, SellerProfile, SellerVideo } from '../types';

const TAB_BAR_HEIGHT = 68;

type Props = {
  marketId?: string;
  sellerId?: string;
  placement?: 'PRODUCT_AD' | 'SHOP_AD';
  compact?: boolean;
  search?: string;
  onTagClick?: (tag: string) => void;
  fullScreen?: boolean;
};

type VideoComment = NonNullable<SellerVideo['comments']>[number];

const videoHtml = (rawUrl?: string | null) => {
  const src = JSON.stringify(normalizeMediaUrl(rawUrl) || '');
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin:0; width:100%; height:100%; background:transparent; overflow:hidden; }
    video { position:fixed; inset:0; width:100%; height:100%; object-fit:cover; background:transparent; }
    button { position:fixed; inset:0; width:100%; height:100%; border:0; background:transparent; display:flex; align-items:center; justify-content:center; }
    span { width:72px; height:72px; border-radius:50%; background:#ff6b00; color:white; display:flex; align-items:center; justify-content:center; font-size:34px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; box-shadow:0 12px 40px rgba(0,0,0,.45); }
    button.hidden { display:none; }
  </style>
</head>
<body>
  <video id="video" src=${src} playsinline webkit-playsinline x5-playsinline="true" loop muted preload="auto"></video>
  <button id="play" aria-label="Play"><span>▶</span></button>
  <script>
    const video = document.getElementById('video');
    const play = document.getElementById('play');
    const hide = () => play.classList.add('hidden');
    const show = () => play.classList.remove('hidden');
    const start = (muted) => {
      video.muted = muted;
      video.play().then(hide).catch(show);
    };
    start(true);
    play.addEventListener('click', () => start(false));
    video.addEventListener('click', () => {
      if (video.paused) start(false);
      else { video.pause(); show(); }
    });
    document.addEventListener('touchend', () => { if (!video.paused) video.muted = false; }, { once: true });
    video.addEventListener('error', show);
    video.addEventListener('stalled', show);
  </script>
</body>
</html>`;
};

const sellerNameOf = (video: SellerVideo) => {
  const seller = typeof video.sellerId === 'object' ? video.sellerId as SellerProfile : null;
  return seller?.shopDetails?.name || seller?.stallName || 'Verified seller';
};

const posterOf = (video: SellerVideo) => {
  const product = typeof video.productId === 'object' ? video.productId as Product : undefined;
  return normalizeImageUrl(video.thumbnailUrl) || imageOf(product);
};

export function SellerVideoFeed({ marketId, sellerId, placement, compact, search, fullScreen = false }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const [videos, setVideos] = useState<SellerVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVideo, setModalVideo] = useState<SellerVideo | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [layoutHeight, setLayoutHeight] = useState<number>(0);

  const cardHeight = layoutHeight > 0 ? layoutHeight : Math.max(480, height - (fullScreen ? TAB_BAR_HEIGHT : 0));

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: compact ? '10' : '30' });
    if (marketId) params.set('marketId', marketId);
    if (sellerId) params.set('sellerId', sellerId);
    if (placement) params.set('placement', placement);
    if (search?.trim()) params.set('search', search.trim());

    try {
      const data = await api.get<SellerVideo[]>('product', `/seller-videos?${params.toString()}`, { auth: false });
      setVideos(asArray<SellerVideo>(data).filter(video => Boolean(video.videoUrl)));
    } catch {
      setVideos([]);
    }
  }, [compact, marketId, placement, search, sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const reactToVideo = async (video: SellerVideo, reaction: 'like' | 'dislike') => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to react to seller videos.');
      return;
    }
    const nextReaction = video.viewerReaction === reaction ? 'none' : reaction;
    try {
      const updated = await api.post<SellerVideo>('product', `/seller-videos/${video._id}/reaction`, { reaction: nextReaction });
      setVideos(current => current.map(item => item._id === video._id ? updated : item));
    } catch {
      Alert.alert('Could not save reaction', 'Please try again.');
    }
  };

  const submitComment = async (video: SellerVideo) => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to comment on seller videos.');
      return;
    }
    const text = (commentText[video._id] || '').trim();
    if (!text) return;

    try {
      const updated = await api.post<SellerVideo>('product', `/seller-videos/${video._id}/comments`, {
        text,
        fullName: user.fullName,
      });
      setVideos(current => current.map(item => item._id === video._id ? updated : item));
      setCommentText(current => ({ ...current, [video._id]: '' }));
    } catch {
      Alert.alert('Could not post comment', 'Please try again.');
    }
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  if (!videos.length) return null;

  if (compact) {
    return (
      <>
        <FlatList
          horizontal
          data={videos}
          keyExtractor={item => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactRail}
          renderItem={({ item }) => (
            <CompactVideoCard video={item} onPress={() => setModalVideo(item)} />
          )}
        />
        <Modal visible={Boolean(modalVideo)} animationType="fade" onRequestClose={() => setModalVideo(null)}>
          <View style={styles.modal}>
            {modalVideo ? (
              <WebView
                source={{ html: videoHtml(modalVideo.videoUrl) }}
                style={StyleSheet.absoluteFillObject}
                allowsInlineMediaPlayback
                allowsFullscreenVideo={false}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                originWhitelist={['*']}
                scrollEnabled={false}
                bounces={false}
                backgroundColor="transparent"
                androidLayerType="hardware"
              />
            ) : null}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVideo(null)} activeOpacity={0.85}>
              <X color={colors.card} size={24} />
            </TouchableOpacity>
            {modalVideo ? <VideoCaption video={modalVideo} onOpenMarket={() => openMarket(router, modalVideo)} /> : null}
          </View>
        </Modal>
      </>
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setLayoutHeight(h);
      }}
    >
      <FlatList
        data={videos}
        keyExtractor={item => item._id}
        pagingEnabled
        snapToInterval={cardHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
        renderItem={({ item, index }) => (
          <FullVideoCard
            video={item}
            active={index === activeIndex && isFocused}
            cardHeight={cardHeight}
            commentText={commentText[item._id] || ''}
            showComments={openComments === item._id}
            onCommentChange={text => setCommentText(current => ({ ...current, [item._id]: text }))}
            onOpenMarket={() => openMarket(router, item)}
            onOpenProduct={() => openProduct(router, item)}
            onReact={reaction => reactToVideo(item, reaction)}
            onSubmitComment={() => submitComment(item)}
            onToggleComments={() => setOpenComments(current => current === item._id ? null : item._id)}
          />
        )}
      />
    </View>
  );
}

function CompactVideoCard({ video, onPress }: { video: SellerVideo; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.compactPoster}>
        <FastImage uri={posterOf(video)} style={StyleSheet.absoluteFillObject} />
        <View style={styles.playCircle}>
          <Play color={colors.card} fill={colors.card} size={20} />
        </View>
        <View style={styles.videoBadge}>
          <Text style={styles.videoBadgeText}>{video.placement === 'SHOP_AD' ? 'Shop ad' : 'Product ad'}</Text>
        </View>
      </View>
      <View style={styles.compactBody}>
        <Text style={styles.compactTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.compactMeta} numberOfLines={1}>{sellerNameOf(video)}</Text>
        <Text style={styles.compactStats}>{video.likeCount || 0} likes · {video.commentCount || 0} comments</Text>
      </View>
    </TouchableOpacity>
  );
}

function FullVideoCard({
  video,
  active,
  cardHeight,
  commentText,
  showComments,
  onCommentChange,
  onOpenMarket,
  onOpenProduct,
  onReact,
  onSubmitComment,
  onToggleComments,
}: {
  video: SellerVideo;
  active: boolean;
  cardHeight: number;
  commentText: string;
  showComments: boolean;
  onCommentChange: (value: string) => void;
  onOpenMarket: () => void;
  onOpenProduct: () => void;
  onReact: (reaction: 'like' | 'dislike') => void;
  onSubmitComment: () => void;
  onToggleComments: () => void;
}) {
  const product = typeof video.productId === 'object' ? video.productId as Product : null;

  return (
    <View style={[styles.fullCard, { height: cardHeight }]}>
      {active ? (
        <WebView
          source={{ html: videoHtml(video.videoUrl) }}
          style={StyleSheet.absoluteFillObject}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={false}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
          backgroundColor="transparent"
          androidLayerType="hardware"
        />
      ) : (
        <FastImage uri={posterOf(video)} style={StyleSheet.absoluteFillObject} />
      )}

      <View style={styles.videoShade} pointerEvents="none" />
      <View style={styles.videoInfo}>
        <VideoCaption video={video} onOpenMarket={onOpenMarket} />
        {product ? (
          <TouchableOpacity style={styles.productButton} onPress={onOpenProduct} activeOpacity={0.85}>
            <Text style={styles.productButtonText} numberOfLines={1}>View {product.name}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.actionStack}>
        <ActionButton
          label={String(video.likeCount || 0)}
          active={video.viewerReaction === 'like'}
          onPress={() => onReact('like')}
          icon={<Heart color={video.viewerReaction === 'like' ? colors.orange : colors.card} fill={video.viewerReaction === 'like' ? colors.orange : 'transparent'} size={28} />}
        />
        <ActionButton
          label={String(video.dislikeCount || 0)}
          active={video.viewerReaction === 'dislike'}
          onPress={() => onReact('dislike')}
          icon={<ThumbsDown color={video.viewerReaction === 'dislike' ? colors.orange : colors.card} fill={video.viewerReaction === 'dislike' ? colors.orange : 'transparent'} size={26} />}
        />
        <ActionButton
          label={String(video.commentCount || 0)}
          onPress={onToggleComments}
          icon={<MessageCircle color={colors.card} size={28} />}
        />
      </View>

      {showComments ? (
        <View style={styles.commentDrawer}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>Comments</Text>
            <TouchableOpacity onPress={onToggleComments} activeOpacity={0.85}>
              <X color={colors.card} size={20} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={asArray<VideoComment>(video.comments).slice().reverse()}
            keyExtractor={(item, index) => item._id || `${video._id}-${index}`}
            contentContainerStyle={styles.commentList}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Text style={styles.commentAuthor}>{item.fullName || 'RMF user'}</Text>
                <Text style={styles.commentBody}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.noComments}>No comments yet.</Text>}
          />
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={onCommentChange}
              placeholder="Add a comment"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.commentInput}
              onSubmitEditing={onSubmitComment}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendButton} onPress={onSubmitComment} activeOpacity={0.85}>
              <Send color={colors.card} size={17} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function VideoCaption({ video, onOpenMarket }: { video: SellerVideo; onOpenMarket: () => void }) {
  // Extract hashtags from caption if tags are empty
  const displayTags = (video.tags && video.tags.length > 0)
    ? video.tags.map(t => t.startsWith('#') ? t : `#${t}`)
    : (video.caption ? video.caption.match(/#[a-zA-Z0-9_-]+/g) || [] : []);

  return (
    <View style={styles.caption}>
      <TouchableOpacity style={styles.sellerRow} onPress={onOpenMarket} activeOpacity={0.85}>
        <Store color={colors.orange} size={14} />
        <Text style={styles.sellerName} numberOfLines={1}>{sellerNameOf(video)}</Text>
      </TouchableOpacity>
      <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
      {video.caption ? <Text style={styles.videoCaption} numberOfLines={3}>{video.caption}</Text> : null}
      {displayTags.length > 0 ? (
        <Text style={styles.tags} numberOfLines={1}>
          {displayTags.join(' ')}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({ icon, label, active, onPress }: { icon: React.ReactNode; label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.actionCircle, active && styles.actionCircleActive]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function openMarket(router: ReturnType<typeof useRouter>, video: SellerVideo) {
  const seller = typeof video.sellerId === 'object' ? video.sellerId as SellerProfile : null;
  const marketId = idOf(video.marketId) || idOf(seller?.marketId);
  if (marketId) router.push(`/market/${marketId}` as any);
}

function openProduct(router: ReturnType<typeof useRouter>, video: SellerVideo) {
  const productId = idOf(video.productId);
  if (productId) router.push(`/product/${productId}` as any);
}

const styles = StyleSheet.create({
  compactRail: {
    gap: 12,
    paddingRight: 16,
  },
  compactCard: {
    width: 194,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadow,
  },
  compactPoster: {
    height: 122,
    backgroundColor: colors.orangeSoft,
  },
  playCircle: {
    position: 'absolute',
    top: 42,
    left: 72,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoBadgeText: {
    color: colors.orangeDark,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  compactBody: {
    padding: 12,
    gap: 4,
  },
  compactTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  compactMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  compactStats: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
  },
  modal: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  fullCard: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  videoShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 270,
    backgroundColor: 'transparent',
  },
  videoInfo: {
    position: 'absolute',
    left: 16,
    right: 86,
    bottom: 28,
    gap: 10,
  },
  caption: {
    gap: 6,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerName: {
    color: colors.orange,
    fontSize: 13,
    fontWeight: '900',
  },
  videoTitle: {
    color: colors.card,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  videoCaption: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  tags: {
    color: colors.orangeSoft,
    fontSize: 12,
    fontWeight: '900',
  },
  productButton: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: colors.orange,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  productButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  actionStack: {
    position: 'absolute',
    right: 12,
    bottom: 92,
    gap: 16,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  actionCircleActive: {
    backgroundColor: 'rgba(255,107,0,0.22)',
  },
  actionLabel: {
    color: colors.card,
    fontSize: 11,
    fontWeight: '900',
  },
  commentDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: 'rgba(22,22,22,0.96)',
    overflow: 'hidden',
  },
  commentHeader: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  commentTitle: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
  },
  commentList: {
    padding: 16,
    gap: 12,
  },
  commentItem: {
    gap: 3,
  },
  commentAuthor: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '900',
  },
  commentBody: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  noComments: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
  },
  commentInputRow: {
    minHeight: 62,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    color: colors.card,
    fontSize: 13,
    fontWeight: '700',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
