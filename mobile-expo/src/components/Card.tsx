import React from 'react';
import {Pressable, View, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {useAppTheme} from '../theme/appTheme';

/** One radius scale for every card in the app. */
export const CARD_RADIUS = {sm: 16, md: 20, lg: 22, xl: 28} as const;

export type CardRadius = keyof typeof CARD_RADIUS;

export type CardTone =
  /** The default raised surface. */
  | 'raised'
  /** A recessed panel nested inside another card — no shadow, it sits *below* the surface. */
  | 'inset'
  /** A secondary surface that lifts only slightly. */
  | 'subtle';

type BaseProps = {
  children?: React.ReactNode;
  tone?: CardTone;
  radius?: CardRadius | number;
  /** Inner padding. `false` for cards that manage their own (media edges, list rows). */
  padding?: number | false;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const resolveRadius = (radius: CardRadius | number): number =>
  typeof radius === 'number' ? radius : CARD_RADIUS[radius];

/**
 * The single definition of what a card looks like: surface colour, hairline border, radius, and
 * the soft shadow. Everything that reads as a card should route through here, so a change to the
 * elevation or the border lands everywhere at once instead of in 70-odd hand-rolled copies.
 */
export const useCardStyle = ({
  tone = 'raised',
  radius = 'lg',
  padding = 16,
}: Omit<BaseProps, 'children' | 'style'> = {}): ViewStyle => {
  const theme = useAppTheme();
  const shadow =
    tone === 'raised' ? theme.cardShadow : tone === 'subtle' ? theme.cardShadowSubtle : null;

  return {
    backgroundColor: tone === 'inset' ? theme.cardSoft : theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: resolveRadius(radius),
    ...(padding === false ? null : {padding}),
    ...(shadow ?? {}),
  };
};

export const Card: React.FC<BaseProps> = ({children, tone, radius, padding, style, testID}) => {
  const cardStyle = useCardStyle({tone, radius, padding});

  return (
    <View testID={testID} style={[cardStyle, style]}>
      {children}
    </View>
  );
};

type PressableCardProps = BaseProps & Omit<PressableProps, 'style' | 'children'>;

/** A card that is itself the tap target. Dips slightly on press instead of only dimming. */
export const PressableCard: React.FC<PressableCardProps> = ({
  children,
  tone,
  radius,
  padding,
  style,
  ...pressableProps
}) => {
  const cardStyle = useCardStyle({tone, radius, padding});

  return (
    <Pressable
      {...pressableProps}
      style={({pressed}) => [cardStyle, pressed ? {opacity: 0.9, transform: [{scale: 0.995}]} : null, style]}>
      {children}
    </Pressable>
  );
};
