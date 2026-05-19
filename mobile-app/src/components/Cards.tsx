import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, Star, Store, Tag } from 'lucide-react-native';
import { money, safeText } from '../lib/format';
import { coordinatesOfMarket, idOf, imageOf, marketOf, sellerProfileOf } from '../lib/normalize';
import { colors, shadow } from '../theme';
import { Market, Product } from '../types';

function ImageFallback({ label }: { label: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export function ProductCard({ product, onPress, compact }: { product: Product; onPress: () => void; compact?: boolean }) {
  const seller = sellerProfileOf(product);
  const image = imageOf(product);
  return (
    <TouchableOpacity style={[styles.product, compact && styles.productCompact]} onPress={onPress} activeOpacity={0.88}>
      <View style={[styles.productImage, compact && styles.productImageCompact]}>
        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <ImageFallback label={product.name} />}
        {product.promotion ? (
          <View style={styles.promoBadge}>
            <Tag color={colors.greenDark} size={10} />
            <Text style={styles.promoText}>Deal</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <Text style={styles.eyebrow} numberOfLines={1}>{product.categoryLabel || product.category || 'Product'}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sellerName} numberOfLines={1}>{seller?.shopDetails?.name || seller?.stallName || 'Verified seller'}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(product.price)}</Text>
          {product.rating ? (
            <View style={styles.rating}>
              <Star color={colors.orange} fill={colors.orange} size={11} />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function MarketCard({ market, onPress }: { market: Market; onPress: () => void }) {
  const coords = coordinatesOfMarket(market);
  return (
    <TouchableOpacity style={styles.market} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.marketImage}>
        {market.imageUrl ? <Image source={{ uri: market.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <ImageFallback label={market.name} />}
      </View>
      <View style={styles.marketBody}>
        <View style={styles.marketHeader}>
          <Text style={styles.marketName} numberOfLines={1}>{market.name}</Text>
          {market.rating ? (
            <View style={styles.rating}>
              <Star color={colors.orange} fill={colors.orange} size={11} />
              <Text style={styles.ratingText}>{market.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaLine}>
          <MapPin color={colors.orange} size={13} />
          <Text style={styles.marketMeta} numberOfLines={1}>
            {market.location?.district || market.location?.address || market.code || 'Rwanda market'}
          </Text>
        </View>
        <View style={styles.metaLine}>
          <Store color={colors.muted} size={13} />
          <Text style={styles.marketMeta}>{market.totalSellers || 0} active sellers</Text>
        </View>
        {coords ? <Text style={styles.coordText}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function OrderLineCard({ item }: { item: any }) {
  return (
    <View style={styles.orderLine}>
      <View style={styles.orderThumb}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <ImageFallback label={safeText(item.name, 'P')} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>{safeText(item.name, 'Product')}</Text>
        <Text style={styles.sellerName}>{item.quantity || 1} x {money(item.unitPrice)}</Text>
      </View>
      <Text style={styles.price}>{money((item.unitPrice || 0) * (item.quantity || 1))}</Text>
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
    width: 164,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow,
  },
  productCompact: {
    width: '48%',
  },
  productImage: {
    height: 120,
    backgroundColor: colors.orangeSoft,
    overflow: 'hidden',
  },
  productImageCompact: {
    height: 132,
  },
  productBody: {
    padding: 12,
    gap: 4,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  productName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  sellerName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: '900',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  promoBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.orange,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.orange,
    fontSize: 22,
    fontWeight: '900',
  },
  market: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadow,
  },
  marketImage: {
    height: 138,
    backgroundColor: colors.greenDark,
  },
  marketBody: {
    padding: 14,
    gap: 7,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  marketName: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marketMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  coordText: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: '700',
  },
  orderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  orderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.orangeSoft,
  },
});

