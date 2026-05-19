import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import React from 'react';
import { colors } from '../theme';
import { Coordinates } from '../types';

export type MapPoint = {
  label: string;
  coordinates?: Coordinates;
  tone?: 'pickup' | 'dropoff' | 'rider';
};

const valueFrom = (value: any): number | undefined => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const coordinatesFromAny = (value: any): Coordinates | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value) && value.length >= 2) {
    const lng = valueFrom(value[0]);
    const lat = valueFrom(value[1]);
    return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  }
  const directLat = valueFrom(value.lat ?? value.latitude);
  const directLng = valueFrom(value.lng ?? value.longitude);
  if (directLat !== undefined && directLng !== undefined) return { lat: directLat, lng: directLng };
  return coordinatesFromAny(value.coordinates || value.location?.coordinates || value.geo || value.pin);
};

const openPoint = (point: MapPoint) => {
  if (!point.coordinates) return;
  const { lat, lng } = point.coordinates;
  const label = encodeURIComponent(point.label);
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`
    : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  Linking.openURL(url);
};

export function MapPreview({ title = 'Live map', points }: { title?: string; points: MapPoint[] }) {
  const valid = points.filter(point => point.coordinates);
  const lats = valid.map(point => point.coordinates!.lat);
  const lngs = valid.map(point => point.coordinates!.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <MapPin color={colors.orange} size={18} />
          <Text style={styles.title}>{title}</Text>
        </View>
        {valid[0] ? (
          <TouchableOpacity style={styles.navButton} onPress={() => openPoint(valid[0])} activeOpacity={0.85}>
            <Navigation color={colors.orangeDark} size={14} />
            <Text style={styles.navText}>Open</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.map}>
        <View style={[styles.gridLine, { top: '33%' }]} />
        <View style={[styles.gridLine, { top: '66%' }]} />
        <View style={[styles.gridLineVertical, { left: '33%' }]} />
        <View style={[styles.gridLineVertical, { left: '66%' }]} />
        {valid.length ? valid.map(point => {
          const left = 8 + ((point.coordinates!.lng - minLng) / lngSpan) * 84;
          const top = 8 + ((maxLat - point.coordinates!.lat) / latSpan) * 84;
          return (
            <TouchableOpacity
              key={`${point.label}-${point.coordinates!.lat}-${point.coordinates!.lng}`}
              style={[
                styles.marker,
                point.tone === 'dropoff' && styles.markerDropoff,
                point.tone === 'rider' && styles.markerRider,
                { left: `${Math.min(Math.max(left, 8), 92)}%`, top: `${Math.min(Math.max(top, 8), 92)}%` },
              ]}
              onPress={() => openPoint(point)}
              activeOpacity={0.85}
            >
              <Text style={styles.markerText}>{point.label.slice(0, 1).toUpperCase()}</Text>
            </TouchableOpacity>
          );
        }) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Location appears when RMF receives coordinates.</Text>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        {points.map(point => (
          <TouchableOpacity key={point.label} style={styles.legendItem} onPress={() => openPoint(point)} disabled={!point.coordinates} activeOpacity={0.85}>
            <View style={[styles.legendDot, point.tone === 'dropoff' && styles.dotDropoff, point.tone === 'rider' && styles.dotRider]} />
            <Text style={styles.legendText} numberOfLines={1}>{point.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  header: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  navButton: {
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.orangeSoft,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  navText: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  map: {
    height: 190,
    backgroundColor: '#fff3e8',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(224,83,0,0.16)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(224,83,0,0.16)',
  },
  marker: {
    position: 'absolute',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  markerDropoff: {
    backgroundColor: colors.orangeDark,
  },
  markerRider: {
    backgroundColor: colors.warning,
  },
  markerText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: '900',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  legend: {
    padding: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.orange,
  },
  dotDropoff: {
    backgroundColor: colors.orangeDark,
  },
  dotRider: {
    backgroundColor: colors.warning,
  },
  legendText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
