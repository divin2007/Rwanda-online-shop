import L from 'leaflet';

const STALE_CONTAINER_ERROR = 'Map container is being reused by another instance';

type PatchedLeafletMapPrototype = typeof L.Map.prototype & {
  __rmfSafeRemovePatched?: boolean;
};

export const patchLeafletSafeRemove = () => {
  const mapPrototype = L.Map.prototype as PatchedLeafletMapPrototype;
  if (mapPrototype.__rmfSafeRemovePatched) return;

  const originalRemove = mapPrototype.remove;

  mapPrototype.remove = function safeRemove(this: L.Map) {
    try {
      return originalRemove.call(this);
    } catch (error) {
      if (error instanceof Error && error.message.includes(STALE_CONTAINER_ERROR)) {
        const mapWithContainer = this as L.Map & {
          _container?: HTMLElement & { _leaflet_id?: number };
          _containerId?: number;
        };

        if (mapWithContainer._container) {
          delete mapWithContainer._container._leaflet_id;
        }
        delete mapWithContainer._containerId;
        return this;
      }

      throw error;
    }
  };

  mapPrototype.__rmfSafeRemovePatched = true;
};
