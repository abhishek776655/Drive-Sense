import {Ionicons} from '@expo/vector-icons';
import {Pressable, ScrollView, View} from 'react-native';
import {ALL_STATS, GAUGE_ACCENTS, MAX_STATS, useDriveSettingsStore} from '../../stores/driveSettingsStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {SpeedScale} from '../../utils/gaugeMath';
import {STAT_META} from '../../utils/liveStats';
import {AppText} from '../AppText';
import {BottomSheet} from './BottomSheet';
import {GaugeDial} from './GaugeDial';
import {GAUGE_STYLE_OPTIONS} from './gaugeStyles';
import {SettingsSwitch} from '../settings/SettingsRows';

/** About two and a half rows of styles show at once; the rest scroll. */
const STYLE_TILE_HEIGHT = 106;
const STYLE_GAP = 6;
const STYLE_PAD = 6;
/** Exactly three rows of tiles; the rest scroll inside the container. */
const STYLE_LIST_HEIGHT = STYLE_TILE_HEIGHT * 3 + STYLE_GAP * 2 + STYLE_PAD * 2 + 2;

const SCALES: SpeedScale[] = ['auto', 120, 200, 300];

function SectionLabel({children}: {children: string}) {
  return (
    <AppText size={10.5} weight="extrabold" tone="secondary" style={{letterSpacing: 0.7, marginTop: 16, marginBottom: 8}}>
      {children}
    </AppText>
  );
}

export function CustomizeSheet({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const theme = useAppTheme();
  const settings = useDriveSettingsStore();
  const full = settings.stats.length >= MAX_STATS;

  return (
    <BottomSheet visible={visible} title="Customize" onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionLabel>GAUGE STYLE</SectionLabel>
        {/* The styles in their own container, scrolling inside it (three to a row), so the rest of
            Customize stays in reach. */}
        <View style={{height: STYLE_LIST_HEIGHT, borderRadius: 22, padding: STYLE_PAD, backgroundColor: theme.colors.glassRow, borderWidth: 1, borderColor: theme.colors.separator}}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{flexDirection: 'row', flexWrap: 'wrap', gap: STYLE_GAP}}>
            {GAUGE_STYLE_OPTIONS.map((style) => {
              const on = settings.gaugeStyle === style.id;
              return (
                <Pressable
                  key={style.id}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                  accessibilityLabel={`${style.label} gauge`}
                  onPress={() => settings.update({gaugeStyle: style.id})}
                  style={{
                    width: '32%',
                    height: STYLE_TILE_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: on ? theme.colors.accent : 'transparent',
                    backgroundColor: on ? theme.colors.accentTint : theme.colors.card,
                  }}>
                  <GaugeDial speed={62} scale={200} gaugeStyle={style.id} accent={settings.gaugeAccent} size={72} />
                  <AppText size={10} weight="extrabold" tone="secondary" numberOfLines={1} style={{marginTop: 4}}>
                    {style.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <SectionLabel>ACCENT</SectionLabel>
        <View style={{flexDirection: 'row', gap: 12}}>
          {GAUGE_ACCENTS.map((color) => {
            const on = settings.gaugeAccent === color;
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                accessibilityLabel={`Accent ${color}`}
                onPress={() => settings.update({gaugeAccent: color})}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: on ? theme.colors.textPrimary : 'transparent',
                }}>
                <View style={{width: 24, height: 24, borderRadius: 12, backgroundColor: color}} />
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>SPEED SCALE</SectionLabel>
        <View style={{flexDirection: 'row', backgroundColor: theme.colors.glassRow, borderRadius: 99, padding: 3}}>
          {SCALES.map((scale) => {
            const on = settings.scale === scale;
            return (
              <Pressable
                key={String(scale)}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                onPress={() => settings.update({scale})}
                style={{flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 99, backgroundColor: on ? theme.colors.accent : 'transparent'}}>
                <AppText size={12} weight="extrabold" color={on ? theme.colors.onAccent : theme.colors.textSecondary}>
                  {scale === 'auto' ? 'Auto' : String(scale)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>MAP</SectionLabel>
        <View style={{gap: 6}}>
          {(
            [
              {key: 'showCompass', icon: 'compass', label: 'Compass & elevation', hint: 'Heading and height under the top bar'},
              {key: 'showCoordinates', icon: 'locate', label: 'Coordinates', hint: 'Latitude and longitude of the car'},
            ] as const
          ).map((row) => (
            <View
              key={row.key}
              style={{flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.glassRow, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10}}>
              <Ionicons name={row.icon} size={18} color={theme.colors.accent} />
              <View style={{flex: 1}}>
                <AppText size={13} weight="extrabold">
                  {row.label}
                </AppText>
                <AppText size={11} weight="semibold" tone="secondary">
                  {row.hint}
                </AppText>
              </View>
              <SettingsSwitch label={row.label} value={settings[row.key]} onChange={(on) => settings.update({[row.key]: on})} />
            </View>
          ))}
        </View>

        <SectionLabel>{`STATS · PICK ${MAX_STATS} · ${settings.stats.length}/${MAX_STATS}`}</SectionLabel>
        <View style={{gap: 6}}>
          {settings.stats.map((id, index) => (
            <View
              key={id}
              style={{flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.glassRow, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9}}>
              <AppText size={12} weight="black" tone="accent" style={{width: 14}}>
                {index + 1}
              </AppText>
              <Ionicons name={STAT_META[id].icon as keyof typeof Ionicons.glyphMap} size={15} color={theme.colors[STAT_META[id].tone]} />
              <AppText size={13} weight="extrabold" style={{flex: 1}}>
                {STAT_META[id].pickerLabel}
              </AppText>
              <Pressable accessibilityLabel={`Move ${STAT_META[id].pickerLabel} up`} hitSlop={6} onPress={() => settings.move(id, -1)} disabled={index === 0}>
                <Ionicons name="chevron-up" size={18} color={index === 0 ? theme.colors.textTertiary : theme.colors.textPrimary} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${STAT_META[id].pickerLabel} down`}
                hitSlop={6}
                onPress={() => settings.move(id, 1)}
                disabled={index === settings.stats.length - 1}>
                <Ionicons name="chevron-down" size={18} color={index === settings.stats.length - 1 ? theme.colors.textTertiary : theme.colors.textPrimary} />
              </Pressable>
              <Pressable accessibilityLabel={`Remove ${STAT_META[id].pickerLabel}`} hitSlop={6} onPress={() => settings.toggle(id)}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10}}>
          {ALL_STATS.filter((id) => !settings.stats.includes(id)).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${STAT_META[id].pickerLabel}`}
              accessibilityState={{disabled: full}}
              disabled={full}
              onPress={() => settings.toggle(id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 99,
                backgroundColor: theme.colors.glassRow,
                opacity: full ? 0.4 : 1,
              }}>
              <Ionicons name="add" size={13} color={theme.colors.textSecondary} />
              <AppText size={11.5} weight="extrabold" tone="secondary">
                {STAT_META[id].pickerLabel}
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppText size={11} weight="semibold" tone="secondary" style={{marginTop: 10, marginBottom: 8}}>
          Map shows the first 4. Gauge shows all 6.
        </AppText>
      </ScrollView>
    </BottomSheet>
  );
}
