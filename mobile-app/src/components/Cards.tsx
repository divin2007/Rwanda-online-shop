import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, ShoppingCart, Star, Store } from 'lucide-react-native';
import { FastImage } from './FastImage';
import { money, safeText } from '../lib/format';
import { idOf, imageOf, marketOf, normalizeImageUrl, normalizeMarketImageUrl, sellerProfileOf } from '../lib/normalize';
import { colors, radii, shadow } from '../theme';
import { Market, Product } from '../types';

function ImageFallback({ label }: { label: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function MadeInRwandaBadge() {
  return (
    <View style={styles.rwandaBadge}>
      <View style={styles.rwandaDot} />
      <Text style={styles.rwandaBadgeText}>MADE IN RWANDA</Text>
    </View>
  );
}

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
  const hasPromo = Boolean(product.promotion);
  const isMadeInRwanda = Boolean(product.isMadeInRwanda);

  return (
    <TouchableOpacity
      style={[styles.product, compact && styles.productCompact, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.productImage, compact && styles.productImageCompact]}>
        <FastImage
          uri={image}
          style={StyleSheet.absoluteFillObject}
          fallback={<ImageFallback label={product.name} />}
        />
        {isMadeInRwanda ? <MadeInRwandaBadge /> : null}
        {hasPromo ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>SALE</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.productBody, compact && styles.productBodyCompact]}>
        <View style={styles.supplierRow}>
          <Store color={colors.body} size={12} strokeWidth={2} />
          <Text style={styles.supplierText} numberOfLines={1}>
            {market?.name || seller?.stallName || 'Verified Supplier'}
          </Text>
        </View>

        <Text style={[styles.productName, compact && styles.productNameCompact]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
              {money(product.price)}
            </Text>
            <Text style={styles.unit} numberOfLines={1}>/{product.unit || 'unit'}</Text>
          </View>
          <View style={styles.cartMini}>
            <ShoppingCart color={colors.ink} size={15} strokeWidth={2.2} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
      <View style={[styles.marketImage, compact && styles.marketImageCompact]}>
        <FastImage
          uri={market.imageUrl ? normalizeMarketImageUrl(market.imageUrl) : undefined}
          style={StyleSheet.absoluteFillObject}
          fallback={<ImageFallback label={market.name} />}
        />
        {rank !== undefined && rank <= 3 ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        ) : null}
        {maxDiscount && maxDiscount > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{maxDiscount}% OFF</Text>
          </View>
        ) : null}
        {distance !== undefined && distance !== Number.POSITIVE_INFINITY ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{distance.toFixed(1)} km</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.marketBody, compact && styles.marketBodyCompact]}>
        <Text style={[styles.marketName, compact && styles.marketNameCompact]} numberOfLines={1}>
          {market.name}
        </Text>
        <View style={styles.marketMeta}>
          <MapPin color={colors.primary} size={compact ? 10 : 12} strokeWidth={2.4} />
          <Text style={[styles.marketMetaText, compact && styles.marketMetaCompact]} numberOfLines={1}>
            {market.location?.district || market.location?.address || market.code || 'Rwanda'}
          </Text>
        </View>
        {!compact ? (
          <View style={styles.marketMeta}>
            <Store color={colors.body} size={12} strokeWidth={2} />
            <Text style={styles.marketMetaText}>{market.totalSellers || 0} sellers</Text>
            {market.rating ? (
              <>
                <Star color={colors.primaryMid} fill={colors.primaryMid} size={11} style={{ marginLeft: 6 }} />
                <Text style={styles.marketMetaText}>{market.rating.toFixed(1)}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

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
        <Text style={styles.orderName} numberOfLines={1}>{safeText(item.name, 'Product')}</Text>
        <Text style={styles.orderQty}>{item.quantity || 1} x {money(item.unitPrice)}</Text>
        {item.variantTitle ? <Text style={styles.variantTag}>{item.variantTitle}</Text> : null}
      </View>
      <Text style={styles.orderTotal}>{money((item.unitPrice || 0) * (item.quantity || 1))}</Text>
    </View>
  );
}

export const productIdentity = (product: Product) => ({
  id: product._id,
  sellerId: idOf(product.sellerId),
  marketId: idOf(product.marketId),
  market: marketOf(product.marketId),
});

const styles = StyleSheet.create({
  product: {
    width: 168,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    ...shadow,
  },
  productCompact: {
    width: '48.2%',
  },
  productImage: {
    height: 136,
    backgroundColor: colors.surfaceMid,
    overflow: 'hidden',
  },
  productImageCompact: {
    height: 150,
  },
  rwandaBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 5,
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.faint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rwandaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primaryMid,
  },
  rwandaBadgeText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  promoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.primaryMid,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
  },
  promoBadgeText: {
    color: colors.card,
    fontSize: 9,
    fontWeight: '900',
  },
  productBody: {
    padding: 12,
    gap: 7,
  },
  productBodyCompact: {
    padding: 10,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  supplierText: {
    color: colors.body,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  productName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  productNameCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  priceRow: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  priceCompact: {
    fontSize: 13,
  },
  unit: {
    color: colors.body,
    fontSize: 10,
    fontWeight: '500',
  },
  cartMini: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  market: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    ...shadow,
  },
  marketCompact: {
    width: '31.3%',
  },
  marketImage: {
    height: 132,
    backgroundColor: colors.surfaceMid,
    overflow: 'hidden',
  },
  marketImageCompact: {
    height: 84,
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  rankText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: '900',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primaryMid,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: '900',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(27,28,27,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
  },
  distanceText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: '800',
  },
  marketBody: {
    padding: 12,
    gap: 6,
  },
  marketBodyCompact: {
    padding: 7,
    gap: 3,
  },
  marketName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  marketNameCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  marketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  marketMetaText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
  },
  marketMetaCompact: {
    fontSize: 9,
  },
  orderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  orderThumb: {
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMid,
  },
  orderName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  orderQty: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  orderTotal: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  variantTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.surfaceMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.body,
    fontSize: 20,
    fontWeight: '800',
  },
});
