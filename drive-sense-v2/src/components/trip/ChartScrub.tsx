import {useMemo, useState} from 'react';
import {PanResponder, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';

/** Index of the point whose x (in pixels) is closest to `x`; `xs` is ascending. */
export const nearestIndex = (xs: number[], x: number): number => {
  if (xs.length === 0) {
    return -1;
  }
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
};

/**
 * Touch layer over a chart: press or drag along it for a cursor line, a dot on the line and a
 * readout of that moment. `toXY` is the chart's own scale (from `linePath`), so the cursor sits
 * exactly on the drawn line. Vertical drags pass through, so the page still scrolls.
 */
export function ChartScrub({
  width,
  height,
  points,
  toXY,
  label,
  color,
}: {
  width: number;
  height: number;
  points: {x: number; y: number}[];
  toXY: (p: {x: number; y: number}) => {x: number; y: number};
  /** The readout for a point, e.g. "84 km/h · 14:32". */
  label: (p: {x: number; y: number}, index: number) => string;
  color: string;
}) {
  const c = useAppTheme().colors;
  const [active, setActive] = useState<number | null>(null);
  const xs = useMemo(() => points.map((p) => toXY(p).x), [points, toXY]);
  const pan = useMemo(() => {
    const at = (x: number) => setActive(nearestIndex(xs, x));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
      onPanResponderMove: (e) => at(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActive(null),
      onPanResponderTerminate: () => setActive(null),
    });
  }, [xs]);
  const point = active != null ? points[active] : null;
  const xy = point ? toXY(point) : null;
  const text = point && active != null ? label(point, active) : '';
  // The readout stays inside the chart: left of the cursor on the right half.
  const flip = xy != null && xy.x > width / 2;
  return (
    <View {...pan.panHandlers} style={{position: 'absolute', left: 0, top: 0, width, height}}>
      {xy ? (
        <View pointerEvents="none" style={{position: 'absolute', left: 0, top: 0, width, height}}>
          <View style={{position: 'absolute', left: xy.x - 0.5, top: 0, width: 1, height, backgroundColor: c.separator}} />
          <View style={{position: 'absolute', left: xy.x - 5, top: xy.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 2, borderColor: c.card}} />
          <View
            style={{
              position: 'absolute',
              top: 0,
              ...(flip ? {right: width - xy.x + 8} : {left: xy.x + 8}),
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.separator,
            }}>
            <AppText size={12} weight="extrabold" style={{fontVariant: ['tabular-nums']}}>
              {text}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
