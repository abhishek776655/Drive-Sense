import {Ionicons} from '@expo/vector-icons';
import {useState, type ReactNode} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDriveSettingsStore} from '../../stores/driveSettingsStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {FONT} from '../../theme/theme';
import {accentColor, CLUSTER_ACCENTS, CLUSTER_INK, type ClusterAccent} from '../accents';
import {CAR_STATS, DRIVE_STATS, THEME_IDS, THEME_NAMES, THEMES, themeOf, type StatOption} from '../settings';

/** A tappable row that opens its options underneath; one open at a time is not enforced, so ticking is quick. */
function Section({title, value, open, onToggle, children}: {title: string; value?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode}) {
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{expanded: open}} accessibilityLabel={title} onPress={onToggle} style={styles.row}>
        <Text style={styles.rowTitle}>{title}</Text>
        <View style={styles.rowEnd}>
          {value}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={CLUSTER_INK.textDim} />
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

function CheckList({options, chosen, onChange, accent}: {options: StatOption[]; chosen: string[]; onChange: (next: string[]) => void; accent: string}) {
  return (
    <View style={styles.checks}>
      {options.map((o) => {
        const on = chosen.includes(o.key);
        return (
          <Pressable
            key={o.key}
            accessibilityRole="checkbox"
            accessibilityState={{checked: on}}
            accessibilityLabel={o.label}
            // Keeps the list's own order whatever order they are ticked in.
            onPress={() => onChange(options.filter((x) => (x.key === o.key ? !on : chosen.includes(x.key))).map((x) => x.key))}
            style={styles.check}>
            <View style={[styles.box, on && {backgroundColor: accent, borderColor: accent}]}>{on ? <Ionicons name="checkmark" size={13} color={CLUSTER_INK.onSwatch} /> : null}</View>
            <Text style={styles.checkLabel}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The cluster's Settings page: a scrollable list. Theme sets the dial styles and accent together
 * (Normal, Vintage, Sports); Color opens the accent swatches; Car and Drive open checkboxes for which
 * stats their pages list.
 */
export function SettingsPage({accent}: {accent: string}) {
  const speedDial = usePreferencesStore((s) => s.clusterSpeedDial);
  const revDial = usePreferencesStore((s) => s.clusterRevDial);
  const accentId = usePreferencesStore((s) => s.clusterAccent);
  const carStats = usePreferencesStore((s) => s.clusterCarStats);
  const driveStats = usePreferencesStore((s) => s.clusterDriveStats);
  const setPrefs = usePreferencesStore((s) => s.set);
  const driveAccent = useDriveSettingsStore((s) => s.gaugeAccent);
  const [open, setOpen] = useState<'color' | 'car' | 'drive' | null>(null);
  const theme = themeOf(speedDial, revDial, accentId);
  const toggle = (id: 'color' | 'car' | 'drive') => setOpen((o) => (o === id ? null : id));

  return (
    <View style={styles.page}>
      <Text style={styles.title}>SETTINGS</Text>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.label}>Theme</Text>
          <View style={styles.themes}>
            {THEME_IDS.map((id) => {
              const on = id === theme;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                  accessibilityLabel={`Theme ${THEME_NAMES[id]}`}
                  onPress={() => void setPrefs({clusterSpeedDial: THEMES[id].speedDial, clusterRevDial: THEMES[id].revDial, clusterAccent: THEMES[id].accent})}
                  style={[styles.theme, on && {borderColor: accent, backgroundColor: CLUSTER_INK.chip}]}>
                  <Text style={[styles.themeText, on && {color: CLUSTER_INK.text}]}>{THEME_NAMES[id]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Section title="Color" open={open === 'color'} onToggle={() => toggle('color')} value={<View style={[styles.dot, {backgroundColor: accent}]} />}>
          <View style={styles.swatches}>
            {(['auto', ...Object.keys(CLUSTER_ACCENTS)] as ClusterAccent[]).map((id) => {
              const on = id === accentId;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={id === 'auto' ? 'Accent: same as speedometer' : `Accent ${id}`}
                  accessibilityState={{selected: on}}
                  onPress={() => void setPrefs({clusterAccent: id})}
                  hitSlop={6}
                  style={[styles.swatch, {backgroundColor: accentColor(id, driveAccent), borderColor: on ? CLUSTER_INK.text : 'transparent'}]}>
                  {id === 'auto' ? <Text style={styles.auto}>A</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Car" open={open === 'car'} onToggle={() => toggle('car')} value={<Text style={styles.count}>{`${carStats.length}/${CAR_STATS.length}`}</Text>}>
          <CheckList options={CAR_STATS} chosen={carStats} onChange={(next) => void setPrefs({clusterCarStats: next})} accent={accent} />
        </Section>

        <Section title="Drive" open={open === 'drive'} onToggle={() => toggle('drive')} value={<Text style={styles.count}>{`${driveStats.length}/${DRIVE_STATS.length}`}</Text>}>
          <CheckList options={DRIVE_STATS} chosen={driveStats} onChange={(next) => void setPrefs({clusterDriveStats: next})} accent={accent} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, paddingHorizontal: 16, paddingTop: 14},
  fill: {flex: 1},
  content: {gap: 4, paddingBottom: 16},
  title: {alignSelf: 'stretch', textAlign: 'center', color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 2, marginBottom: 10},
  label: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6},
  themes: {flexDirection: 'row', gap: 8, marginBottom: 6},
  theme: {flex: 1, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: CLUSTER_INK.glassEdge, alignItems: 'center', justifyContent: 'center'},
  themeText: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 12},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLUSTER_INK.glassEdge},
  rowTitle: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 14},
  rowEnd: {flexDirection: 'row', alignItems: 'center', gap: 8},
  count: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
  dot: {width: 14, height: 14, borderRadius: 7},
  body: {paddingBottom: 8},
  swatches: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  swatch: {width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  auto: {color: CLUSTER_INK.onSwatch, fontFamily: FONT.black, fontSize: 12},
  checks: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8},
  check: {flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 110},
  box: {width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: CLUSTER_INK.textFaint, alignItems: 'center', justifyContent: 'center'},
  checkLabel: {color: CLUSTER_INK.text, fontFamily: FONT.bold, fontSize: 13},
});
