import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Glass} from '../Glass';

/** 28.61290° N: five decimals is about a metre, plenty for "where am I". */
export const formatCoordinate = (value: number, axis: 'lat' | 'lon'): string => {
  const hemisphere = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(5)}° ${hemisphere}`;
};

/** The car's position as latitude and longitude, on the Drive map (Customize → Map → Coordinates). */
export function CoordinatesChip({latitude, longitude}: {latitude: number | null; longitude: number | null}) {
  const c = useAppTheme().colors;
  const known = latitude != null && longitude != null;
  return (
    <Glass radius={14} style={{alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6}}>
      <View
        accessible
        accessibilityLabel={known ? `Latitude ${formatCoordinate(latitude, 'lat')}, longitude ${formatCoordinate(longitude, 'lon')}` : 'Position unknown'}
        style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
        <Ionicons name="locate" size={13} color={c.accent} />
        <AppText size={12} weight="extrabold" style={{fontVariant: ['tabular-nums']}}>
          {known ? `${formatCoordinate(latitude, 'lat')}  ${formatCoordinate(longitude, 'lon')}` : 'Waiting for GPS…'}
        </AppText>
      </View>
    </Glass>
  );
}
