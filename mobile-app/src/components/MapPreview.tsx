import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';
import { Coordinates } from '../types';
import { buildLeafletSatelliteLayer, buildLeafletStandardLayer } from '../lib/mapTiles';

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

const openPoint = async (point: MapPoint) => {
  if (!point.coordinates) return;
  const { lat, lng } = point.coordinates;
  const label = encodeURIComponent(point.label);
  const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;

  try {
    if (Platform.OS === 'ios') {
      const supported = await Linking.canOpenURL(appleMapsUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(appleMapsUrl);
      } else {
        await Linking.openURL(googleMapsUrl);
      }
    } else {
      const supported = await Linking.canOpenURL(geoUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(geoUrl);
      } else {
        await Linking.openURL(googleMapsUrl);
      }
    }
  } catch (err) {
    try {
      await Linking.openURL(googleMapsUrl);
    } catch (e) {
      console.warn('Map Linking failed', e);
    }
  }
};

const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { padding: 0; margin: 0; background-color: #fdfaf7; }
    html, body, #map { height: 100%; width: 100vw; }
    .leaflet-bar { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
    .leaflet-bar a { background-color: #ffffff !important; color: #ff6b00 !important; border-bottom: 1px solid #ebdcd0 !important; }
    .leaflet-bar a:hover { color: #e05300 !important; }
    .leaflet-bar a:first-child { border-top-left-radius: 8px !important; border-top-right-radius: 8px !important; }
    .leaflet-bar a:last-child { border-bottom-left-radius: 8px !important; border-bottom-right-radius: 8px !important; border-bottom: none !important; }
    .custom-tooltip {
      background-color: #ffffff;
      border: 1px solid #ebdcd0;
      border-radius: 6px;
      padding: 4px 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #17201a;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([-1.9441, 30.0619], 13);
    
    ${buildLeafletStandardLayer('standardLayer', true)}
    ${buildLeafletSatelliteLayer('satelliteLayer')}

    var markersGroup = L.featureGroup().addTo(map);

    function createMarkerIcon(color, text) {
      var svg = '<svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.625C11.8934 20.625 9.375 18.1066 9.375 15C9.375 11.8934 11.8934 9.375 15 9.375C18.1066 9.375 20.625 11.8934 20.625 15C20.625 18.1066 18.1066 20.625 15 20.625Z" fill="' + color + '"/>' +
        '</svg>';
      
      return L.divIcon({
        html: '<div style="position: relative; width: 30px; height: 42px;">' + svg + 
              '<span style="position: absolute; top: 8px; left: 0; width: 30px; text-align: center; color: white; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 900; pointer-events: none;">' + text + '</span>' +
              '</div>',
        className: '',
        iconSize: [30, 42],
        iconAnchor: [15, 42]
      });
    }

    var colors = {
      pickup: '#ff6b00',
      dropoff: '#ea580c',
      rider: '#b45309'
    };

    window.updatePoints = function(points) {
      markersGroup.clearLayers();
      var validPoints = [];
      
      points.forEach(function(p) {
        if (p.coordinates && typeof p.coordinates.lat === 'number' && typeof p.coordinates.lng === 'number') {
          var color = colors[p.tone] || '#ff6b00';
          var label = p.label || 'Point';
          var text = label.substring(0, 1).toUpperCase();
          
          var icon = createMarkerIcon(color, text);
          var marker = L.marker([p.coordinates.lat, p.coordinates.lng], { icon: icon });
          
          marker.bindTooltip(label, { 
            permanent: true, 
            direction: 'top', 
            className: 'custom-tooltip',
            offset: [0, -38]
          });
          
          markersGroup.addLayer(marker);
          validPoints.push([p.coordinates.lat, p.coordinates.lng]);
        }
      });

      if (validPoints.length > 0) {
        var bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    };

    window.setMapMode = function(mode) {
      if (mode === 'satellite') {
        map.removeLayer(standardLayer);
        satelliteLayer.addTo(map);
      } else {
        map.removeLayer(satelliteLayer);
        standardLayer.addTo(map);
      }
    };

    function handleNativeMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'updatePoints') {
          window.updatePoints(data.points);
        } else if (data.type === 'setMapMode') {
          window.setMapMode(data.mode);
        }
      } catch(err) {
        // console.error(err);
      }
    }
    
    document.addEventListener('message', handleNativeMessage);
    window.addEventListener('message', handleNativeMessage);
  </script>
</body>
</html>
`;

export function MapPreview({ title = 'Live map', points }: { title?: string; points: MapPoint[] }) {
  const webViewRef = useRef<WebView>(null);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const valid = points.filter(point => point.coordinates);

  useEffect(() => {
    if (webViewRef.current && valid.length > 0) {
      const data = JSON.stringify({ type: 'updatePoints', points });
      webViewRef.current.postMessage(data);
    }
  }, [points]);

  const toggleMapMode = () => {
    const nextMode = mapMode === 'standard' ? 'satellite' : 'standard';
    setMapMode(nextMode);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'setMapMode', mode: nextMode }));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <MapPin color={colors.orange} size={18} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.mapModeButton} onPress={toggleMapMode} activeOpacity={0.85}>
            <Text style={styles.mapModeText}>
              {mapMode === 'standard' ? '🛰️ Satellite' : '🗺️ Standard'}
            </Text>
          </TouchableOpacity>
          {valid[0] ? (
            <TouchableOpacity style={styles.navButton} onPress={() => openPoint(valid[0])} activeOpacity={0.85}>
              <Navigation color={colors.orangeDark} size={14} />
              <Text style={styles.navText}>Open</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.mapContainer}>
        {valid.length > 0 ? (
          <WebView
            ref={webViewRef}
            source={{ html: leafletHtml }}
            style={styles.mapWebview}
            onLoadEnd={() => {
              if (webViewRef.current) {
                webViewRef.current.postMessage(JSON.stringify({ type: 'updatePoints', points }));
                webViewRef.current.postMessage(JSON.stringify({ type: 'setMapMode', mode: mapMode }));
              }
            }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Location appears when RMF receives coordinates.</Text>
          </View>
        )}
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapModeButton: {
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.orangeSoft,
    paddingHorizontal: 9,
    justifyContent: 'center',
  },
  mapModeText: {
    color: colors.orangeDark,
    fontSize: 10,
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
  mapContainer: {
    height: 250,
    backgroundColor: '#fdfaf7',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  mapWebview: {
    flex: 1,
    backgroundColor: 'transparent',
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
