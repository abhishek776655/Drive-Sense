import Svg, {Circle, G, Path} from 'react-native-svg';

/** Glyphs from the v2 mockups (Rovy-style), drawn in the active colour. */
export type TabIconName = 'home' | 'route' | 'road' | 'car';

export function TabIcon({name, color, size = 26}: {name: TabIconName; color: string; size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* "House", "Road" and "Car" from Lucide (lucide.dev, ISC licence). */}
      {name === 'home' && (
        <G fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
          <Path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </G>
      )}
      {name === 'route' && (
        <G fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={6} cy={5.5} r={2.3} />
          <Circle cx={18} cy={18.5} r={2.3} />
          <Path d="M8.3 5.5H15a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.7" />
        </G>
      )}
      {name === 'road' && (
        <G fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 17v4" />
          <Path d="M12 5V3" />
          <Path d="M12 9v3" />
          <Path d="M2.077 18.449A2 2 0 0 0 4 21h16a2 2 0 0 0 1.924-2.55l-4-14A2 2 0 0 0 16 3H8a2 2 0 0 0-1.924 1.45z" />
        </G>
      )}
      {name === 'car' && (
        <G fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <Circle cx={7} cy={17} r={2} />
          <Path d="M9 17h6" />
          <Circle cx={17} cy={17} r={2} />
        </G>
      )}
    </Svg>
  );
}
