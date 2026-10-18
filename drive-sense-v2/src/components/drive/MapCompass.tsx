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
  /** Which way the map is turned (0 = north-up). The dial stays put; this is kept for callers. */
  mapHeadingDeg?: number;
  /** Current altitude (m); shown in a chip under the compass. Leave it out to hide the chip (replay). */
  altitudeM?: number | null;
}

/**
 * A compass like a real one: the dial stays still with N at the top and the needle turns to the
 * direction of travel, read out in degrees and on a 16-point compass underneath.
 */
export function MapCompass({headingDeg, moving, altitudeM}: MapCompassProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const needle = normalizeHeading(headingDeg ?? 0);
  const showHeading = moving && headingDeg != null;
  const label = showHeading ? `${Math.round(normalizeHeading(headingDeg)) % 360}° ${compass16(headingDeg)}` : '–';
  const r = SIZE / 2;

  return (
    <View
      style={{alignItems: 'center', gap: 4}}
      accessibilityRole="image"
      accessibilityLabel={`${showHeading ? `Heading ${label}` : 'Heading unknown'}${altitudeM === undefined ? '' : `, elevation ${altitudeM != null ? `${Math.round(altitudeM)} metres` : 'unknown'}`}`}>
      <Glass style={{width: SIZE, height: SIZE}}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* The dial: fixed, N at the top. No tick at 0°: the N letter sits there. */}
          <G>
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
            <SvgText x={r} y={11} textAnchor="middle" fontSize={9} fontFamily={theme.font.black} fill={c.accent}>
              N
            </SvgText>
          </G>
          {/* The needle: its orange tip points the way you are heading. */}
          <G rotation={needle} origin={`${r}, ${r}`}>
            <Path d={`M${r} ${r - 15} L${r + 5} ${r} L${r - 5} ${r} Z`} fill={c.accent} />
            <Path d={`M${r} ${r + 15} L${r + 5} ${r} L${r - 5} ${r} Z`} fill={c.textTertiary} />
          </G>
          <Circle cx={r} cy={r} r={2.5} fill={c.textPrimary} />
        </Svg>
      </Glass>
      <Glass radius={10} style={{paddingHorizontal: 7, paddingVertical: 2}}>
        <AppText size={11} weight="black">
          {label}
        </AppText>
      </Glass>
      {altitudeM === undefined ? null : (
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
      )}
    </View>
  );
}
