import {useState} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {linePath} from '../trip/chartPath';

const H = 44;

/** A minute of one value: label and current reading on top, the line under it. */
export function Sparkline({label, value, unit, points, color}: {label: string; value: string; unit: string; points: {x: number; y: number}[]; color: string}) {
  const c = useAppTheme().colors;
  const [width, setWidth] = useState(0);
  const {line, area} = linePath(points, width, H, 2);
  return (
    <Card style={{flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6}}>
      <AppText size={12} weight="bold" tone="secondary">
        {label}
      </AppText>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
        <AppText size={18} weight="black" style={{fontVariant: ['tabular-nums']}}>
          {value}
        </AppText>
        <AppText size={11} weight="semibold" tone="secondary">
          {unit}
        </AppText>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{height: H}}>
        {width > 0 && points.length > 1 ? (
          <Svg width={width} height={H}>
            <Path d={area} fill={color} fillOpacity={0.12} />
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
