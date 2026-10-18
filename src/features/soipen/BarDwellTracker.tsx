import { useAuth } from '../../auth/AuthProvider';
import { useMyLocation } from '../location/LocationProvider';
import { usePlaces } from '../map/places';
import { useBarDwell } from './useBarDwell';

/** Invisible: logs time spent at après-ski bars for the Soipen-meter. */
export function BarDwellTracker() {
  const { session } = useAuth();
  const { position } = useMyLocation();
  const places = usePlaces();
  useBarDwell(position, places, session?.user.id);
  return null;
}
