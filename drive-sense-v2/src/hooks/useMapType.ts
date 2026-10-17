import {Platform} from 'react-native';
import {usePreferencesStore, type MapStyle} from '../stores/preferencesStore';

type MapType = 'standard' | 'mutedStandard' | 'satellite' | 'hybrid';

/** Muted is iOS-only; elsewhere it falls back to the standard map. */
export const mapTypeFor = (style: MapStyle, os: string = Platform.OS): MapType => {
  if (style === 'muted') {
    return os === 'ios' ? 'mutedStandard' : 'standard';
  }
  return style;
};

/** `mapType` for a MapView, from Settings → Map style. */
export function useMapType(): MapType {
  const style = usePreferencesStore((s) => s.mapStyle);
  return mapTypeFor(style);
}
