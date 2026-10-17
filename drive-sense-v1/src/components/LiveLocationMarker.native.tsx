import React from 'react';
import {View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';

type Props = {
  color: string;
  /** Tilted camera mode. Marker is drawn on the ground plane in both modes; 3D only scales it up. */
  is3D?: boolean;
  /**
   * When false the puck drops the direction arrow. GPS course is meaningless while stationary,
   * so pointing an arrow somewhere would be a lie.
   */
  isMoving?: boolean;
};

/**
 * Heading is NOT applied here. The marker is rendered facing "up" (0deg = marker forward) and the
 * caller rotates it through `<Marker flat rotation={...} />` so the rotation happens in map space:
 * it stays correct when the user rotates the map and when the camera is pitched in 3D.
 */
export const LiveLocationMarker: React.FC<Props> = ({color, is3D = false, isMoving = true}) => {
  const strongBlue = color || '#1D4ED8';
  const haloFill = 'rgba(59,130,246,0.20)';
  const haloBorder = 'rgba(255,255,255,0.78)';

  const box = is3D ? 76 : 56;
  const halo = is3D ? 52 : 34;
  const arrowSize = is3D ? 46 : 26;
  const arrowInner = is3D ? 32 : 18;
  const dot = is3D ? 24 : 16;

  return (
    <View style={{width: box, height: box, alignItems: 'center', justifyContent: 'center'}}>
      {/* Concentric halo — stays concentric under a pitched camera because the marker is flat. */}
      <View
        style={{
          position: 'absolute',
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: haloFill,
          borderWidth: 1,
          borderColor: haloBorder,
        }}
      />

      {isMoving ? (
        <View
          style={{
            width: arrowSize,
            height: arrowSize,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#0F172A',
            shadowOpacity: 0.18,
            shadowRadius: is3D ? 10 : 6,
            shadowOffset: {width: 0, height: is3D ? 4 : 3},
            elevation: is3D ? 10 : 6,
          }}>
          <MaterialCommunityIcons
            name="navigation"
            size={arrowSize}
            color="#FFFFFF"
            style={{position: 'absolute'}}
          />
          <MaterialCommunityIcons name="navigation" size={arrowInner} color={strongBlue} />
        </View>
      ) : (
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: strongBlue,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            shadowColor: '#0F172A',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: {width: 0, height: 3},
            elevation: 6,
          }}
        />
      )}
    </View>
  );
};
