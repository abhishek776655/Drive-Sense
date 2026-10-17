import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../utils/drivingThresholds';

export type SmoothnessBand = 'smooth' | 'moderate' | 'harsh';

export const getSmoothnessBand = (magnitude: number): SmoothnessBand => {
  // magnitude <= 0 is the "unavailable / not yet measured" sentinel (e.g. before a trip starts,
  // or after it ends) — a phone genuinely at rest reads ~GRAVITY_MPS2, never 0, so treat 0 as smooth
  // rather than a real reading.
  if (magnitude <= 0) {
    return 'smooth';
  }

  // `magnitude` is the total 3D accelerometer reading including gravity. Remove gravity's
  // contribution (assumed roughly orthogonal to horizontal motion) via Pythagorean subtraction to
  // get the horizontal-equivalent acceleration, then band that directly against the same
  // thresholds the event-detection pipeline uses.
  const horizontalAccel = Math.sqrt(Math.max(0, magnitude * magnitude - GRAVITY_MPS2 * GRAVITY_MPS2));
  if (horizontalAccel >= Math.abs(HARSH_BRAKE_MPS2)) {
    return 'harsh';
  }
  if (horizontalAccel >= RAPID_ACCELERATION_MPS2) {
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
