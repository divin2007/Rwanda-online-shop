'use client';

import { TileLayer } from 'react-leaflet';

type RmfTileLayerProps = {
  variant?: 'standard' | 'satellite';
};

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const mapboxStyleUrl = (style: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;

export const RmfTileLayer = ({ variant = 'standard' }: RmfTileLayerProps) => {
  if (mapboxToken) {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={mapboxStyleUrl(variant === 'satellite' ? 'satellite-streets-v12' : 'streets-v12')}
        tileSize={512}
        zoomOffset={-1}
      />
    );
  }

  if (variant === 'satellite') {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
      />
    );
  }

  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
};

