import {Ionicons} from '@expo/vector-icons';
import {useEffect, useState, type ComponentProps} from 'react';
import {Animated, Easing, View} from 'react-native';
import Svg, {Circle, ClipPath, Defs, Path, Rect} from 'react-native-svg';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {RoadLogo} from '../brand/RoadLogo';
import {useReduceMotion} from './motion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const ROUTE = 'M12 120 C 60 120, 70 70, 120 72 S 180 112, 230 104 S 280 40, 318 32';
const ROUTE_END = {x: 318, y: 32};

/** Location step: a dotted route draws itself left to right, then its end point keeps pulsing. */
export function RouteArt() {
  const c = useAppTheme().colors;
  const reduce = useReduceMotion();
  const [draw] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, {toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false}));
    Animated.timing(draw, {toValue: 1, duration: reduce ? 0 : 1300, delay: 250, easing: Easing.inOut(Easing.cubic), useNativeDriver: false}).start(() => {
      if (!reduce) {
        loop.start();
      }
    });
    return () => loop.stop();
  }, [draw, pulse, reduce]);
  return (
    <Svg width="100%" height={150} viewBox="0 0 330 150">
      <Defs>
        <ClipPath id="routeReveal">
          <AnimatedRect x={0} y={0} height={150} width={draw.interpolate({inputRange: [0, 1], outputRange: [0, 330]})} />
        </ClipPath>
      </Defs>
      <Path d={ROUTE} stroke={c.onAccent} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 14" fill="none" clipPath="url(#routeReveal)" />
      <AnimatedCircle
        cx={ROUTE_END.x}
        cy={ROUTE_END.y}
        r={pulse.interpolate({inputRange: [0, 1], outputRange: [10, 24]})}
        fill={c.onAccent}
        opacity={pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 0]})}
      />
      <AnimatedCircle cx={ROUTE_END.x} cy={ROUTE_END.y} r={draw.interpolate({inputRange: [0, 0.9, 1], outputRange: [0, 0, 10]})} fill={c.onAccent} />
    </Svg>
  );
}

interface SampleNotice {
  title: string;
  body: string;
  when: string;
}

const NOTICES: SampleNotice[] = [
  {title: 'Drive saved', body: '12.4 km · 23 min · Score 92', when: 'now'},
  {title: 'You forgot to end your drive', body: 'Tap to stop it and save your stats.', when: '12m ago'},
  {title: 'Weekly goal reached', body: '4 of 4 drives this week. Nice rhythm.', when: '2h ago'},
];

/** Notifications step: three sample notifications drop in one after another. */
export function NotificationArt() {
  const c = useAppTheme().colors;
  const reduce = useReduceMotion();
  const [drops] = useState(() => NOTICES.map(() => new Animated.Value(0)));
  useEffect(() => {
    Animated.stagger(
      140,
      drops.map((v) => Animated.spring(v, {toValue: 1, damping: 15, stiffness: 140, useNativeDriver: true})),
    ).start();
  }, [drops]);
  return (
    <View style={{gap: 12}}>
      {NOTICES.map((n, i) => (
        <Animated.View
          key={n.title}
          style={{
            backgroundColor: c.onAccent,
            borderRadius: 24,
            padding: 16,
            gap: 4,
            opacity: drops[i],
            transform: [{translateY: drops[i].interpolate({inputRange: [0, 1], outputRange: [reduce ? 0 : -18, 0]})}],
          }}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <RoadLogo variant="tile" size={22} />
            <AppText size={13} weight="extrabold" color={c.accentDeep} style={{letterSpacing: 1, flex: 1}}>
              DRIVESENSE
            </AppText>
            <AppText size={13} weight="semibold" color={withAlpha(c.accentDeep, 0.7)}>
              {n.when}
            </AppText>
          </View>
          <AppText size={17} weight="black" color={c.accentDeep}>
            {n.title}
          </AppText>
          <AppText size={15} weight="semibold" color={withAlpha(c.accentDeep, 0.8)}>
            {n.body}
          </AppText>
        </Animated.View>
      ))}
    </View>
  );
}

const CHECK = 'M28 52 L44 68 L74 36';
const CHECK_LENGTH = 70;
const BURST = 12;

/** Done step: the circle springs up, the check strokes itself on, and dots burst outwards. */
export function DoneCheck() {
  const c = useAppTheme().colors;
  const reduce = useReduceMotion();
  const [grow] = useState(() => new Animated.Value(0));
  const [stroke] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.spring(grow, {toValue: 1, damping: 11, stiffness: 160, useNativeDriver: true}),
      Animated.parallel([
        Animated.timing(stroke, {toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false}),
        Animated.timing(burst, {toValue: 1, duration: reduce ? 0 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
      ]),
    ]).start();
  }, [grow, stroke, burst, reduce]);
  return (
    <View style={{width: 104, height: 104, alignItems: 'center', justifyContent: 'center'}}>
      {reduce
        ? null
        : Array.from({length: BURST}, (_, i) => {
            const angle = (i / BURST) * Math.PI * 2;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  width: i % 2 ? 8 : 6,
                  height: i % 2 ? 8 : 6,
                  borderRadius: 4,
                  backgroundColor: c.onAccent,
                  opacity: burst.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, 1, 0]}),
                  transform: [
                    {translateX: burst.interpolate({inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 92]})},
                    {translateY: burst.interpolate({inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 92]})},
                  ],
                }}
              />
            );
          })}
      <Animated.View style={{transform: [{scale: grow}]}}>
        <Svg width={104} height={104} viewBox="0 0 104 104">
          <Circle cx={52} cy={52} r={52} fill={c.onAccent} />
          <AnimatedPath
            d={CHECK}
            stroke={c.accentDeep}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            strokeDashoffset={stroke.interpolate({inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0]})}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A row of an icon in a soft circle and a line of copy (Rovy's benefit lists). */
export function BenefitRow({icon, text}: {icon: ComponentProps<typeof Ionicons>['name']; text: string}) {
  const c = useAppTheme().colors;
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 16}}>
      <View style={{width: 46, height: 46, borderRadius: 23, backgroundColor: withAlpha(c.onAccent, 0.18), alignItems: 'center', justifyContent: 'center'}}>
        <Ionicons name={icon} size={22} color={c.onAccent} />
      </View>
      <AppText size={17} weight="extrabold" color={c.onAccent} style={{flex: 1}}>
        {text}
      </AppText>
    </View>
  );
}
