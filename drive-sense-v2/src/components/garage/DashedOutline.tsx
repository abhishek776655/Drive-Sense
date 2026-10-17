import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Rect} from 'react-native-svg';

interface DashedOutlineProps {
  radius: number;
  color: string;
  width?: number;
  dash?: [number, number];
}

/**
 * Rovy's dashed boundary, drawn as SVG so dash length and gap can be set (a View's dashed border
 * ties both to the border width). Fills its parent; put it first so content sits above it.
 */
export function DashedOutline({radius, color, width = 2, dash = [10, 7]}: DashedOutlineProps) {
  const [size, setSize] = useState({w: 0, h: 0});
  const inset = width / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setSize({w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height})}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Rect
            x={inset}
            y={inset}
            width={size.w - width}
            height={size.h - width}
            rx={radius - inset}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeDasharray={dash.join(' ')}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
