import {View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

const STROKE = 18;

/** The big level dial: a green arc of progress toward the next level, the level number inside. */
export function LevelRing({level, fraction, size = 200}: {level: number; fraction: number; size?: number}) {
  const c = useAppTheme().colors;
  const r = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  // A sliver always shows, so level 1 at 0 XP still reads as a dial.
  const arc = Math.max(0.03, fraction) * circumference;
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={size} height={size} style={{position: 'absolute'}}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.separator} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.green}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <AppText size={52} weight="black" style={{lineHeight: 60}}>
        {level}
      </AppText>
      <AppText size={11} weight="extrabold" tone="secondary" style={{letterSpacing: 1}}>
        LEVEL
      </AppText>
    </View>
  );
}
