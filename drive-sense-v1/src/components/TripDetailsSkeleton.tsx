import React from 'react';
import {View} from 'react-native';
import {SkeletonBlock, SkeletonRow} from './SkeletonBlock';
import {useCardStyle} from './Card';

/**
 * Placeholder shaped like the loaded trip-details card, so the screen does not jump when the real
 * content lands. Mirrors TripRouteInsightsCard: vehicle header, map, route block, stat grid.
 */
export const TripDetailsSkeleton: React.FC = () => {
  const cardStyle = useCardStyle({radius: 28});

  return (
    <View>
      <View style={[cardStyle, {marginBottom: 14}]}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
          <SkeletonBlock height={40} width={56} radius={12} />
          <View style={{flex: 1, marginLeft: 10}}>
            <SkeletonBlock height={18} width="60%" radius={8} />
            <SkeletonBlock height={12} width="40%" radius={6} style={{marginTop: 6}} />
          </View>
        </View>

        <SkeletonBlock height={300} radius={24} style={{marginBottom: 12}} />

        <View style={{marginBottom: 12}}>
          <SkeletonBlock height={16} width="30%" radius={6} />
          <SkeletonBlock height={18} width="75%" radius={6} style={{marginTop: 6}} />
          <SkeletonBlock height={16} width="30%" radius={6} style={{marginTop: 14}} />
          <SkeletonBlock height={18} width="70%" radius={6} style={{marginTop: 6}} />
        </View>

        <SkeletonRow count={3} height={34} />
      </View>

      <View style={[cardStyle, {marginBottom: 14, borderRadius: 24}]}>
        <SkeletonBlock height={16} width="35%" radius={6} style={{marginBottom: 12}} />
        <SkeletonRow count={2} height={64} gap={10} />
        <View style={{height: 10}} />
        <SkeletonRow count={2} height={64} gap={10} />
      </View>
    </View>
  );
};
