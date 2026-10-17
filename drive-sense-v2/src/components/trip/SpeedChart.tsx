import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {useUnits} from '../../hooks/useUnits';
import {useAppTheme} from '../../theme/ThemeProvider';
import {speedColor, speedScaleStops} from '../../utils/speedColor';
import type {SpeedSample} from '../../utils/tripAnalysis';
import {kmhInUnits} from '../../utils/units';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {linePath} from './chartPath';
import {clockTime} from './timeOfDay';

const H = 120;

/** Speed over the drive; the line takes the route's speed colours, so map and chart read as one. */
export function SpeedChart({samples, peak}: {samples: SpeedSample[]; peak: SpeedSample | null}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const [width, setWidth] = useState(0);
  if (samples.length < 2 || !peak) {
    return null;
  }
  const {line, area, toXY} = linePath(samples.map((s) => ({x: s.t, y: s.kmh})), width, H);
  const top = Math.max(peak.kmh, 1);
  // Gradient runs bottom (0 km/h) to the peak's height, in chart space, so a colour sits at its speed.
  const stops = [...speedScaleStops(c).filter((s) => s.kmh < top), {kmh: top, color: speedColor(top, c)}];
  const peakXY = toXY({x: peak.t, y: peak.kmh});
  return (
    <Card style={{padding: 16, gap: 10}}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height: H}}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            <Defs>
              <LinearGradient id="tripSpeedStroke" gradientUnits="userSpaceOnUse" x1={0} y1={H - 4} x2={0} y2={peakXY.y}>
                {stops.map((s) => (
                  <Stop key={s.kmh} offset={s.kmh / top} stopColor={s.color} />
                ))}
              </LinearGradient>
            </Defs>
            <Path d={area} fill={c.accent} fillOpacity={0.1} />
            <Path d={line} fill="none" stroke="url(#tripSpeedStroke)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={peakXY.x} cy={peakXY.y} r={5} fill={speedColor(peak.kmh, c)} stroke={c.card} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 6}}>
        <AppText size={13} weight="bold" tone="secondary">
          Peak
        </AppText>
        <AppText size={15} weight="black">
          {kmhInUnits(peak.kmh, u.units)} {u.speedUnit}
        </AppText>
        <AppText size={13} weight="semibold" tone="tertiary">
          at {clockTime(peak.t)}
        </AppText>
      </View>
    </Card>
  );
}
