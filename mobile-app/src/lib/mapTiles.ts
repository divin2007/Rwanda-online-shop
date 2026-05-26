import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || extra.mapboxAccessToken || '';

const mapboxTileUrl = (style: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxAccessToken)}`;

export const buildLeafletStandardLayer = (variableName = 'standardLayer', addToMap = false) => {
  if (mapboxAccessToken) {
    return `var ${variableName} = L.tileLayer(${JSON.stringify(mapboxTileUrl('streets-v12'))}, {maxZoom:20,tileSize:512,zoomOffset:-1});${addToMap ? `${variableName}.addTo(map);` : ''}`;
  }

  return `var ${variableName} = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19});${addToMap ? `${variableName}.addTo(map);` : ''}`;
};

export const buildLeafletSatelliteLayer = (variableName = 'satelliteLayer') => {
  if (mapboxAccessToken) {
    return `var ${variableName} = L.tileLayer(${JSON.stringify(mapboxTileUrl('satellite-streets-v12'))}, {maxZoom:20,tileSize:512,zoomOffset:-1});`;
  }

  return `var ${variableName} = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19});`;
};

