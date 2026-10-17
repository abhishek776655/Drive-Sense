import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import Svg, {Circle, G, Line, Path, Text as SvgText} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {compass16, normalizeHeading} from '../../utils/heading';
import {AppText} from '../AppText';
import {Glass} from '../Glass';

const SIZE = 52;

interface MapCompassProps {
  /** Direction of travel, or null while it is unknown. */
  headingDeg: number | null;
  /** Shown only while moving: a parked car's course is noise. */
  moving: boolean;
  /** Which way the map is turned (0 = north-up); the needle counter-rotates to keep pointing north. */
  mapHeadingDeg: number;
  /** Current altitude (m); shown in a chip under the compass. */
  altitudeM: number | null;
}

/**
 * Compass for the map: the dial's N always points at real north (it turns as the 3D map turns),
 * with the direction of travel in degrees and on a 16-point compass underneath.
 */
export function MapCompass({headingDeg, moving, mapHeadingDeg, altitudeM}: MapCompassProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const north = -normalizeHeading(mapHeadingDeg);
  const showHeading = moving && headingDeg != null;
  const label = showHeading ? `${Math.round(normalizeHeading(headingDeg)) % 360}° ${compass16(headingDeg)}` : '–';
  const r = SIZE / 2;

  return (
    <View style={{alignItems: 'center', gap: 4}} accessibilityRole="image" accessibilityLabel={`${showHeading ? `Heading ${label}` : 'Heading unknown'}, elevation ${altitudeM != null ? `${Math.round(altitudeM)} metres` : 'unknown'}`}>
      <Glass style={{width: SIZE, height: SIZE}}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <G rotation={north} origin={`${r}, ${r}`}>
            {/* No tick at 0°: the N letter sits there. */}
            {Array.from({length: 11}, (_, k) => {
              const i = k + 1;
              const a = (i * 30 * Math.PI) / 180;
              const outer = r - 4;
              const inner = i % 3 === 0 ? r - 9 : r - 7;
              return (
                <Line
                  key={i}
                  x1={r + Math.sin(a) * inner}
                  y1={r - Math.cos(a) * inner}
                  x2={r + Math.sin(a) * outer}
                  y2={r - Math.cos(a) * outer}
                  stroke={c.textSecondary}
                  strokeWidth={i % 3 === 0 ? 1.6 : 1}
                  strokeLinecap="round"
                />
              );
            })}
            <Path d={`M${r} ${r - 15} L${r + 5} ${r} L${r - 5} ${r} Z`} fill={c.accent} />
            <Path d={`M${r} ${r + 15} L${r + 5} ${r} L${r - 5} ${r} Z`} fill={c.textTertiary} />
            <SvgText x={r} y={11} textAnchor="middle" fontSize={9} fontFamily={theme.font.black} fill={c.accent}>
              N
            </SvgText>
          </G>
          <Circle cx={r} cy={r} r={2.5} fill={c.textPrimary} />
        </Svg>
      </Glass>
      <Glass radius={10} style={{paddingHorizontal: 7, paddingVertical: 2}}>
        <AppText size={11} weight="black">
          {label}
        </AppText>
      </Glass>
      <Glass radius={12} style={{marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center'}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
          <Ionicons name="triangle" size={10} color={c.teal} />
          <AppText size={12} weight="black">
            {altitudeM != null ? Math.round(altitudeM) : '–'}
          </AppText>
          <AppText size={9} weight="bold" tone="secondary">
            m
          </AppText>
        </View>
        <AppText size={8} weight="extrabold" tone="secondary" style={{letterSpacing: 0.5}}>
          ELEV
        </AppText>
      </Glass>
    </View>
  );
}
