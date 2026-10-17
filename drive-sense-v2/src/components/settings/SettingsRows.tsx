import {Ionicons} from '@expo/vector-icons';
import {Children, Fragment, type ReactNode} from 'react';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import {Platform, Pressable, Switch, View} from 'react-native';
import {softShadow} from '../../theme/shadow';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

type IconName = keyof typeof Ionicons.glyphMap;

/** A Rovy settings card: rows with hairlines between them, inset past the icons. */
export function SettingsGroup({children}: {children: ReactNode}) {
  const c = useAppTheme().colors;
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <Card style={{paddingHorizontal: 16}}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{height: 1, marginLeft: 44, backgroundColor: c.separator}} /> : null}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}

interface SettingsRowProps {
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle?: string;
  /** Control or value on the right (switch, pills, value text). */
  right?: ReactNode;
  /** Shown under the row, inset like the title (e.g. "Stop after" pills). */
  below?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

/** Icon, title and subtitle, with a control on the right; a chevron when the row opens something. */
export function SettingsRow({icon, iconColor, title, subtitle, right, below, onPress, destructive}: SettingsRowProps) {
  const c = useAppTheme().colors;
  const content = (pressed: boolean) => (
    <View style={{paddingVertical: 14, gap: 12, opacity: pressed ? 0.6 : 1}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
        <View style={{width: 30, alignItems: 'center'}}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{flex: 1}}>
          <AppText size={16} weight="extrabold" color={destructive ? c.red : undefined}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText size={12} weight="semibold" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
        {onPress && !right ? <Ionicons name="chevron-forward" size={17} color={c.textTertiary} /> : null}
      </View>
      {below ? <View style={{marginLeft: 44}}>{below}</View> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {({pressed}) => content(pressed)}
    </Pressable>
  ) : (
    content(false)
  );
}

export function SettingsSwitch({value, onChange, label}: {value: boolean; onChange: (value: boolean) => void; label: string}) {
  const c = useAppTheme().colors;
  return <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{true: c.accent, false: c.control}} ios_backgroundColor={c.separator} />;
}

/** Width of each segment when the control is not stretched across its row. */
const SEGMENT_WIDTH = 64;

/**
 * Pill switch (km/h · mph). On iOS it is the native segmented control, so on iOS 26 its thumb is the
 * same Liquid Glass lens as the switches (it stretches as you drag it); elsewhere, a raised pill.
 */
export function PillChoice<T extends string | number>({options, value, onChange, stretch}: {options: {value: T; label: string}[]; value: T; onChange: (value: T) => void; stretch?: boolean}) {
  const theme = useAppTheme();
  const c = theme.colors;
  if (Platform.OS === 'ios') {
    return (
      <SegmentedControl
        values={options.map((o) => o.label)}
        selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
        onChange={(event) => onChange(options[event.nativeEvent.selectedSegmentIndex].value)}
        appearance={theme.scheme}
        fontStyle={{fontFamily: theme.font.semibold, fontSize: 14, color: c.textPrimary}}
        activeFontStyle={{fontFamily: theme.font.extrabold, fontWeight: '800', fontSize: 14, color: c.textPrimary}}
        style={{height: 34, width: stretch ? undefined : options.length * SEGMENT_WIDTH, alignSelf: stretch ? 'stretch' : 'auto'}}
      />
    );
  }
  return (
    <View style={{flexDirection: 'row', backgroundColor: c.canvas, borderRadius: 99, padding: 3, alignSelf: stretch ? 'stretch' : 'auto'}}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{selected: on}}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{flex: stretch ? 1 : undefined, minWidth: stretch ? 0 : 52, height: 32, paddingHorizontal: stretch ? 4 : 12, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.card : 'transparent', ...(on ? softShadow(c, 'small') : null)}}>
            <AppText size={14} weight={on ? 'extrabold' : 'semibold'} color={on ? c.textPrimary : c.textSecondary} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small uppercase label above a group (Rovy / Home style). */
export function SettingsLabel({children}: {children: string}) {
  return (
    <AppText size={12} weight="extrabold" tone="secondary" style={{letterSpacing: 0.8, marginTop: 22, marginBottom: 8, marginLeft: 16}}>
      {children}
    </AppText>
  );
}
