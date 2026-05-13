import React from 'react';
import {View, type DimensionValue} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

type Props = {
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: object;
};

export const SkeletonBlock: React.FC<Props> = ({height, width = '100%', radius = 16, style}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: theme.cardSoft,
          borderColor: theme.cardBorder,
          borderWidth: 1,
        },
        style,
      ]}
    />
  );
};
