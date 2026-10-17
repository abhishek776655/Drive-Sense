import {Ionicons} from '@expo/vector-icons';
import type {ReactNode} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useAppTheme} from '../theme/ThemeProvider';
import {DASH} from '../utils/format';
import {AppText} from './AppText';
import {Card} from './Card';

type IconName = keyof typeof Ionicons.glyphMap;

/** Turn-sign glyph (diamond with a right-turn arrow) from the Home mockup. */
function TurnIcon({color, size = 18}: {color: string; size?: number}) {
  const theme = useAppTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill={color} />
      <Path
        d="M9 15v-3.2a1.8 1.8 0 0 1 1.8-1.8H15m0 0-1.8-1.8M15 10l-1.8 1.8"
        fill="none"
        stroke={theme.colors.card}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Header({icon, title}: {icon: ReactNode; title: string}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
      {icon}
      <AppText size={13} weight="bold" tone="secondary">
        {title}
      </AppText>
    </View>
  );
}

/** Two values side by side with a hairline divider, each with a small icon + label underneath. */
function TwoUp({items}: {items: [{value: ReactNode; label: string; icon: IconName; color: string}, {value: ReactNode; label: string; icon: IconName; color: string}]}) {
  const theme = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
      {items.map((item, i) => (
        <View key={item.label} style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
          {i === 1 ? <View style={{width: 1, alignSelf: 'stretch', backgroundColor: theme.colors.separator}} /> : null}
          <View style={{flex: 1, alignItems: 'center'}}>
            {typeof item.value === 'string' ? (
              <AppText size={20} weight="black">
                {item.value}
              </AppText>
            ) : (
              item.value
            )}
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2}}>
              <Ionicons name={item.icon} size={11} color={item.color} />
              <AppText size={11} weight="bold" tone="secondary">
                {item.label}
              </AppText>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Left/right turn split: a two-colour bar sized by share, counts underneath. */
export function TurnsCard({left, right}: {left: number | null; right: number | null}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const hasData = left != null && right != null && left + right > 0;
  return (
    <Card style={{flex: 1, padding: 14, minHeight: 104}}>
      <Header icon={<TurnIcon color={c.blue} />} title="Turns" />
      <View style={{flexDirection: 'row', gap: 5, marginTop: 12}}>
        {hasData ? (
          <>
            <View style={{flex: left, height: 8, borderRadius: 4, backgroundColor: c.blue}} />
            <View style={{flex: right, height: 8, borderRadius: 4, backgroundColor: c.purple}} />
          </>
        ) : (
          <View style={{flex: 1, height: 8, borderRadius: 4, backgroundColor: c.separator}} />
        )}
      </View>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 9}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
          <View style={{width: 7, height: 7, borderRadius: 4, backgroundColor: c.blue}} />
          <AppText size={13} weight="extrabold">
            {left ?? DASH} L
          </AppText>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
          <AppText size={13} weight="extrabold">
            {right ?? DASH} R
          </AppText>
          <View style={{width: 7, height: 7, borderRadius: 4, backgroundColor: c.purple}} />
        </View>
      </View>
    </Card>
  );
}

export function EventsCard({accel, brake}: {accel: number | null; brake: number | null}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Card style={{flex: 1, padding: 14, minHeight: 104}}>
      <Header icon={<Ionicons name="warning" size={17} color={c.amber} />} title="Events" />
      <TwoUp
        items={[
          {value: accel == null ? DASH : String(accel), label: 'Accel', icon: 'flash', color: c.green},
          {value: brake == null ? DASH : String(brake), label: 'Brake', icon: 'warning', color: c.red},
        ]}
      />
    </Card>
  );
}

export function AltitudeCard({highest, lowest}: {highest: number | null; lowest: number | null}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const value = (n: number | null, icon: IconName, color: string) => (
    <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
      <Ionicons name={icon} size={17} color={color} />
      <AppText size={20} weight="black">
        {n == null ? DASH : String(Math.round(n))}
      </AppText>
      <AppText size={12} weight="bold" tone="secondary">
        m
      </AppText>
    </View>
  );
  return (
    <Card style={{padding: 14}}>
      <Header icon={<Ionicons name="triangle" size={16} color={c.teal} />} title="Altitude" />
      <TwoUp
        items={[
          {value: value(highest, 'arrow-up', c.teal), label: 'Highest', icon: 'trending-up', color: c.teal},
          {value: value(lowest, 'arrow-down', c.red), label: 'Lowest', icon: 'trending-down', color: c.red},
        ]}
      />
    </Card>
  );
}

/** Uppercase section label between Home blocks, as in the mockup. */
export function SectionLabel({children}: {children: string}) {
  return (
    <AppText size={12} weight="extrabold" tone="secondary" style={{letterSpacing: 0.8, marginTop: 22, marginBottom: 8, marginLeft: 4}}>
      {children}
    </AppText>
  );
}
