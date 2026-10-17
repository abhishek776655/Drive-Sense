import type {ReactNode} from 'react';
import {View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {withAlpha} from '../theme/color';

export const RING = 40;
const STROKE = 5;

/** A small progress ring (0..1) with optional content in the middle; Home's half-width tiles. */
export function ProgressRing({share, color, label, children}: {share: number; color: string; label: string; children?: ReactNode}) {
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{width: RING, height: RING, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={RING} height={RING} accessibilityLabel={label} style={{position: 'absolute'}}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={withAlpha(color, 0.2)} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * Math.min(1, Math.max(0, share))} ${circumference}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
