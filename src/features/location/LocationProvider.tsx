import { createContext, useContext, type ReactNode } from 'react';
import { useLocationSharing, type LocationSharing } from './useLocationSharing';

const LocationContext = createContext<LocationSharing>({
  position: null,
  lastSent: null,
  error: null,
  shareNow: async () => {},
});

export const useMyLocation = () => useContext(LocationContext);

/** One GPS watcher for the whole app, shared by the map, navigation and the bar-dwell tracker. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const value = useLocationSharing();
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
