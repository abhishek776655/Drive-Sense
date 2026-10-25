import {Circle, LinearGradient, RadialGradient, vec} from '@shopify/react-native-skia';
import {CLUSTER_INK} from '../accents';

/** The shared dial face for the phone dials: vignetted face and a bevelled rim, as on ArcDial. */
export function DialFace({cx, cy, r}: {cx: number; cy: number; r: number}) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r + 12}>
        <RadialGradient c={vec(cx, cy - r * 0.2)} r={r * 1.25} colors={[CLUSTER_INK.faceEdge, CLUSTER_INK.face, '#000000']} positions={[0, 0.7, 1]} />
      </Circle>
      <Circle cx={cx} cy={cy} r={r + 12} style="stroke" strokeWidth={1.5}>
        <LinearGradient start={vec(cx, cy - r)} end={vec(cx, cy + r)} colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.6)']} />
      </Circle>
    </>
  );
}
