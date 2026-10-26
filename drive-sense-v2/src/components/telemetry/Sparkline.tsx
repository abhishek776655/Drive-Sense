import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {linePath} from '../trip/chartPath';

const H = 44;

/**
 * A minute of one value: label and current reading on top, the line under it. Full-width graphs
 * pass a taller `height` and a `peak` ("Peak 45 kW") shown on the right of the header.
 */
export function Sparkline({
  label,
  value,
  unit,
  points,
  color,
  height = H,
  peak,
}: {
  label: string;
  value: string;
  unit: string;
  points: {x: number; y: number}[];
  color: string;
  height?: number;
  peak?: string | null;
}) {
  const c = useAppTheme().colors;
  const [width, setWidth] = useState(0);
  const {line, area} = linePath(points, width, height, 2);
  const fillId = `spark-${label}`;
  return (
    <Card style={{flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <AppText size={12} weight="bold" tone="secondary" style={{flex: 1}}>
          {label}
        </AppText>
        {peak ? (
          <AppText size={11} weight="bold" tone="tertiary" style={{fontVariant: ['tabular-nums']}}>
            {peak}
          </AppText>
        ) : null}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
        <AppText size={18} weight="black" style={{fontVariant: ['tabular-nums']}}>
          {value}
        </AppText>
        <AppText size={11} weight="semibold" tone="secondary">
          {unit}
        </AppText>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height}}>
        {width > 0 && points.length > 1 ? (
          <Svg width={width} height={height}>
            {/* The area fades out downward, so the line reads first. */}
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill={`url(#${fillId})`} />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : (
          <View style={{flex: 1, justifyContent: 'center'}}>
            <View style={{height: 2, borderRadius: 1, backgroundColor: c.separator}} />
          </View>
        )}
      </View>
    </Card>
  );
}
