import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, Star, Store } from 'lucide-react-native';
import { FastImage } from './FastImage';
import { money, safeText } from '../lib/format';
import { coordinatesOfMarket, idOf, imageOf, marketOf, sellerProfileOf, normalizeMarketImageUrl, normalizeImageUrl } from '../lib/normalize';
import { colors, shadow, radii } from '../theme';
import { Market, Product } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Image fallback (initials)
// ─────────────────────────────────────────────────────────────────────────────
function ImageFallback({ label }: { label: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Star rating row
// ─────────────────────────────────────────────────────────────────────────────
function RatingRow({ rating }: { rating: number }) {
  return (
    <View style={styles.ratingRow}>
      <Star color={colors.gold} fill={colors.gold} size={9} />
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductCard — Alibaba 3-column compact card
// ─────────────────────────────────────────────────────────────────────────────
export function ProductCard({
  product,
  onPress,
  compact,
  style,
}: {
  product: Product;
  onPress: () => void;
  compact?: boolean;
  style?: any;
}) {
  const seller = sellerProfileOf(product);
  const market = marketOf(product.marketId);
  const image = imageOf(product);
  const isNegotiable = String(product.isNegotiable) === 'true' || product.isNegotiable === true;
  const hasPromo = Boolean(product.promotion);
  const isMadeInRwanda = Boolean(product.isMadeInRwanda);

  return (
    <TouchableOpacity
      style={[styles.product, compact && styles.productCompact, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image */}
      <View style={[styles.productImage, compact && styles.productImageCompact]}>
        <FastImage
          uri={image}
          style={StyleSheet.absoluteFillObject}
          fallback={<ImageFallback label={product.name} />}
        />

        {/* Badges overlaid on image */}
        <View style={styles.imageBadges}>
          {hasPromo && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>SALE</Text>
            </View>
          )}
          {!hasPromo && isNegotiable && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>Chat</Text>
            </View>
          )}
        </View>

        {isMadeInRwanda && (
          <View style={styles.rwandaBadge}>
            <Text style={styles.rwandaBadgeText}>🇷🇼</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={[styles.productBody, compact && styles.productBodyCompact]}>
        {/* Price — most prominent, like Alibaba */}
        <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
          {money(product.price)}
        </Text>

        {/* Minimum Order */}
        <Text style={styles.minOrder} numberOfLines={1}>
          Min. Order: 1 {product.unit || 'unit'}
        </Text>

        {/* Product name */}
        <Text style={[styles.productName, compact && styles.productNameCompact]} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Supplier / Market Location */}
        <Text style={styles.supplierText} numberOfLines={1}>
          {market?.name || seller?.stallName || 'Verified Supplier'}
        </Text>

        {/* Seller + Rating row */}
        <View style={styles.metaRow}>
          {product.rating ? <RatingRow rating={product.rating} /> : null}
          {product.totalOrders ? (
            <Text style={styles.ordersText}>{product.totalOrders} sold</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketCard — Alibaba market stall card
// ─────────────────────────────────────────────────────────────────────────────
export function MarketCard({
  market,
  onPress,
  distance,
  maxDiscount,
  rank,
  compact,
  style,
}: {
  market: Market;
  onPress: () => void;
  distance?: number;
  maxDiscount?: number;
  rank?: number;
  compact?: boolean;
  style?: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.market, compact && styles.marketCompact, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image */}
      <View style={[styles.marketImage, compact && styles.marketImageCompact]}>
        <FastImage
          uri={market.imageUrl ? normalizeMarketImageUrl(market.imageUrl) : undefined}
          style={StyleSheet.absoluteFillObject}
          fallback={<ImageFallback label={market.name} />}
        />

        {/* Rank badge */}
        {rank !== undefined && rank <= 3 ? (
          <View style={[styles.rankBadge, rank === 1 && styles.rankGold, rank === 2 && styles.rankSilver, rank === 3 && styles.rankBronze]}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        ) : null}

        {/* Discount badge */}
        {maxDiscount && maxDiscount > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{maxDiscount}% OFF</Text>
          </View>
        ) : null}

        {/* Distance */}
        {distance !== undefined && distance !== Number.POSITIVE_INFINITY ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{distance.toFixed(1)}km</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={[styles.marketBody, compact && styles.marketBodyCompact]}>
        <Text style={[styles.marketName, compact && styles.marketNameCompact]} numberOfLines={1}>
          {market.name}
        </Text>

        <View style={styles.marketMeta}>
          <MapPin color={colors.primary} size={compact ? 9 : 11} strokeWidth={2.5} />
          <Text style={[styles.marketMetaText, compact && styles.marketMetaCompact]} numberOfLines={1}>
            {market.location?.district || market.location?.address || market.code || 'Rwanda'}
          </Text>
        </View>

        {!compact && (
          <View style={styles.marketMeta}>
            <Store color={colors.muted} size={11} strokeWidth={2} />
            <Text style={styles.marketMetaText}>{market.totalSellers || 0} sellers</Text>
            {market.rating ? (
              <>
                <Star color={colors.gold} fill={colors.gold} size={10} style={{ marginLeft: 6 }} />
                <Text style={styles.ratingText}>{market.rating.toFixed(1)}</Text>
              </>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrderLineCard
// ─────────────────────────────────────────────────────────────────────────────
export function OrderLineCard({ item }: { item: any }) {
  return (
    <View style={styles.orderLine}>
      <View style={styles.orderThumb}>
        <FastImage
          uri={item.imageUrl ? normalizeImageUrl(item.imageUrl) : undefined}
          style={StyleSheet.absoluteFillObject}
          fallback={<ImageFallback label={safeText(item.name, 'P')} />}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>{safeText(item.name, 'Product')}</Text>
        <Text style={styles.orderQty}>{item.quantity || 1} × {money(item.unitPrice)}</Text>
        {item.variantTitle ? (
          <Text style={styles.variantTag}>🏷 {item.variantTitle}</Text>
        ) : null}
      </View>
      <Text style={styles.orderTotal}>{money((item.unitPrice || 0) * (item.quantity || 1))}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
export const productIdentity = (product: Product) => ({
  id: product._id,
  sellerId: idOf(product.sellerId),
  marketId: idOf(product.marketId),
  market: marketOf(product.marketId),
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Product card ────────────────────────────────────────────────────────────
  product: {
    width: 160,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.divider,
    ...shadow,
  },
  productCompact: {
    width: '48.2%',
  },
  productImage: {
    height: 120,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  productImageCompact: {
    height: 130,
  },
  imageBadges: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    gap: 3,
    zIndex: 5,
  },
  promoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  promoBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chatBadge: {
    backgroundColor: '#FFF3CD',
    borderWidth: 0.5,
    borderColor: colors.warning,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  chatBadgeText: {
    color: colors.warning,
    fontSize: 7,
    fontWeight: '800',
  },
  rwandaBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  rwandaBadgeText: {
    fontSize: 8,
  },
  productBody: {
    padding: 8,
    gap: 3,
  },
  productBodyCompact: {
    padding: 5,
    gap: 2,
  },
  price: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  priceCompact: {
    fontSize: 11,
    fontWeight: '800',
  },
  minOrder: {
    color: '#e05300',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  supplierText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  productName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  productNameCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  ordersText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '500',
  },

  // ── Market card ─────────────────────────────────────────────────────────────
  market: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.divider,
    ...shadow,
  },
  marketCompact: {
    width: '31.3%',
  },
  marketImage: {
    height: 130,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  marketImageCompact: {
    height: 80,
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  rankGold: { backgroundColor: colors.gold },
  rankSilver: { backgroundColor: '#B0B8C1' },
  rankBronze: { backgroundColor: '#CD7F32' },
  rankText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  discountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    zIndex: 10,
  },
  discountText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  distanceBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 10,
  },
  distanceText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  marketBody: {
    padding: 10,
    gap: 4,
  },
  marketBodyCompact: {
    padding: 5,
    gap: 2,
  },
  marketName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  marketNameCompact: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  marketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  marketMetaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  marketMetaCompact: {
    fontSize: 8,
    fontWeight: '500',
  },

  // ── Order line ──────────────────────────────────────────────────────────────
  orderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  orderThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  orderQty: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  variantTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Shared ──────────────────────────────────────────────────────────────────
  fallback: {
    flex: 1,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: '700',
  },
});
