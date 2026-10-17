import Svg, {Defs, Line, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import {BRAND_INK, BRAND_ROAD, centreDashes, FADE_TOP_Y, HORIZON, LOGO_SIZE, roadPath, TILE_RADIUS} from '../../brand/logo';

const ROAD = roadPath();
const DASHES_AT_REST = centreDashes(0);

/**
 * The DriveSense road. `tile` is the app-icon look (black rounded square); `mark` is the road on its
 * own, fading in from the bottom like the splash. `phase` (0–1) slides the lane dashes toward the
 * horizon, which is how the intro makes the road move.
 */
export function RoadLogo({size, variant, phase = 0}: {size: number; variant: 'tile' | 'mark'; phase?: number}) {
  const tile = variant === 'tile';
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`} accessibilityLabel="DriveSense">
      {tile ? (
        <Rect width={LOGO_SIZE} height={LOGO_SIZE} rx={TILE_RADIUS} fill={BRAND_INK} />
      ) : (
        <Defs>
          <LinearGradient id="roadFade" x1={0} y1={LOGO_SIZE} x2={0} y2={FADE_TOP_Y} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={BRAND_ROAD} stopOpacity={0} />
            <Stop offset={1} stopColor={BRAND_ROAD} stopOpacity={1} />
          </LinearGradient>
        </Defs>
      )}
      <Line
        x1={HORIZON.x1}
        x2={HORIZON.x2}
        y1={HORIZON.y}
        y2={HORIZON.y}
        stroke={BRAND_ROAD}
        strokeOpacity={HORIZON.opacity}
        strokeWidth={HORIZON.width}
        strokeLinecap="round"
      />
      <Path d={ROAD} fill={tile ? BRAND_ROAD : 'url(#roadFade)'} />
      <Path d={phase === 0 ? DASHES_AT_REST : centreDashes(phase)} fill={BRAND_INK} />
    </Svg>
  );
}
