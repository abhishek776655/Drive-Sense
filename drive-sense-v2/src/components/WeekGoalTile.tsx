import Svg, {Circle} from 'react-native-svg';
import {withAlpha} from '../theme/color';
import {useAppTheme} from '../theme/ThemeProvider';
import {BentoTile} from './BentoTile';

const RING = 34;
const STROKE = 5;

/** Home: drives done this week against the goal set in onboarding, with a progress ring. */
export function WeekGoalTile({target, done}: {target: number; done: number}) {
  const c = useAppTheme().colors;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(1, done / target);
  const met = done >= target;
  return (
    <BentoTile
      label={met ? 'Weekly goal reached' : 'Weekly goal'}
      value={`${done}/${target}`}
      unit="drives"
      accessory={
        <Svg width={RING} height={RING} accessibilityLabel={`${done} of ${target} drives this week`}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={withAlpha(c.accent, 0.2)} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={met ? c.green : c.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
      }
    />
  );
}
