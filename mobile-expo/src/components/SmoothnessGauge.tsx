import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../utils/drivingThresholds';

export type SmoothnessBand = 'smooth' | 'moderate' | 'harsh';

export const getSmoothnessBand = (magnitude: number): SmoothnessBand => {
  const deviation = Math.abs(magnitude - GRAVITY_MPS2);
  if (deviation >= Math.abs(HARSH_BRAKE_MPS2)) {
    return 'harsh';
  }
  if (deviation >= RAPID_ACCELERATION_MPS2) {
    return 'moderate';
  }
  return 'smooth';
};

const BAND_LABEL: Record<SmoothnessBand, string> = {
  smooth: 'Smooth',
  moderate: 'Moderate',
  harsh: 'Harsh',
};

type Props = {
  magnitude: number;
};

export const SmoothnessGauge: React.FC<Props> = ({magnitude}) => {
  const theme = useAppTheme();
  const band = getSmoothnessBand(magnitude);
  const toneColor = band === 'harsh' ? theme.danger : band === 'moderate' ? theme.warning : theme.success;

  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
      <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor, marginRight: 6}} />
      <Text style={{color: toneColor, ...theme.typography.caption, fontWeight: '700'}}>
        {BAND_LABEL[band]} • {magnitude.toFixed(1)} m/s²
      </Text>
    </View>
  );
};
