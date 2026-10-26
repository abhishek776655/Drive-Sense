import {Ionicons} from '@expo/vector-icons';
import {useState, type ReactNode} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDriveSettingsStore} from '../../stores/driveSettingsStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {FONT} from '../../theme/theme';
import {accentColor, CLUSTER_ACCENTS, CLUSTER_INK, type ClusterAccent} from '../accents';
import {CAR_STATS, DRIVE_STATS, THEME_IDS, THEME_NAMES, THEMES, themeOf, type StatOption} from '../settings';

type Screen = 'theme' | 'color' | 'car' | 'drive';

/** One option in the list: its name, what it is set to now, and a chevron into its own page. */
function Row({title, value, onPress}: {title: string; value: ReactNode; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.rowEnd}>
        {value}
        <Ionicons name="chevron-forward" size={15} color={CLUSTER_INK.textDim} />
      </View>
    </Pressable>
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
 * The cluster's Settings page: a short list of options. Each opens its own page with a back arrow:
 * Theme (Normal, Vintage, Sports: the dial styles and accent together), Color (the accent swatches),
 * Car and Drive (checkboxes for which stats their pages list).
 */
export function SettingsPage({accent}: {accent: string}) {
  const speedDial = usePreferencesStore((s) => s.clusterSpeedDial);
  const revDial = usePreferencesStore((s) => s.clusterRevDial);
  const accentId = usePreferencesStore((s) => s.clusterAccent);
  const carStats = usePreferencesStore((s) => s.clusterCarStats);
  const driveStats = usePreferencesStore((s) => s.clusterDriveStats);
  const setPrefs = usePreferencesStore((s) => s.set);
  const driveAccent = useDriveSettingsStore((s) => s.gaugeAccent);
  const [screen, setScreen] = useState<Screen | null>(null);
  const theme = themeOf(speedDial, revDial, accentId);

  if (screen == null) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>SETTINGS</Text>
        <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Row title="Theme" value={<Text style={styles.count}>{theme ? THEME_NAMES[theme] : 'Custom'}</Text>} onPress={() => setScreen('theme')} />
          <Row title="Color" value={<View style={[styles.dot, {backgroundColor: accent}]} />} onPress={() => setScreen('color')} />
          <Row title="Car" value={<Text style={styles.count}>{`${carStats.length}/${CAR_STATS.length}`}</Text>} onPress={() => setScreen('car')} />
          <Row title="Drive" value={<Text style={styles.count}>{`${driveStats.length}/${DRIVE_STATS.length}`}</Text>} onPress={() => setScreen('drive')} />
        </ScrollView>
      </View>
    );
  }

  const titles: Record<Screen, string> = {theme: 'THEME', color: 'COLOR', car: 'CAR STATS', drive: 'DRIVE STATS'};
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={() => setScreen(null)} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={CLUSTER_INK.text} />
        </Pressable>
        <Text style={[styles.title, styles.headerTitle]}>{titles[screen]}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {screen === 'theme' ? (
          <View style={styles.stack}>
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
        ) : null}
        {screen === 'color' ? (
          <View style={styles.stack}>
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
        ) : null}
        {screen === 'car' ? <CheckList options={CAR_STATS} chosen={carStats} onChange={(next) => void setPrefs({clusterCarStats: next})} accent={accent} /> : null}
        {screen === 'drive' ? <CheckList options={DRIVE_STATS} chosen={driveStats} onChange={(next) => void setPrefs({clusterDriveStats: next})} accent={accent} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // A narrow column in the middle of the pane, not edge to edge.
  page: {flex: 1, alignSelf: 'center', width: '100%', maxWidth: 230, paddingTop: 14},
  fill: {flex: 1},
  content: {gap: 4, paddingBottom: 16},
  // The options' pages: one centred column, top to bottom.
  stack: {alignItems: 'center', gap: 12},
  title: {alignSelf: 'stretch', textAlign: 'center', color: CLUSTER_INK.textFaint, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 2, marginBottom: 10},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  back: {width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
  // `title` stretches; in the header row it must centre on the back button instead.
  headerTitle: {flex: 1, marginBottom: 0, alignSelf: 'center'},
  theme: {width: 160, height: 36, borderRadius: 17, borderWidth: 1.5, borderColor: CLUSTER_INK.glassEdge, alignItems: 'center', justifyContent: 'center'},
  themeText: {color: CLUSTER_INK.textDim, fontFamily: FONT.extrabold, fontSize: 12},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLUSTER_INK.glassEdge},
  rowTitle: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 14},
  rowEnd: {flexDirection: 'row', alignItems: 'center', gap: 8},
  count: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 12, fontVariant: ['tabular-nums']},
  dot: {width: 14, height: 14, borderRadius: 7},
  swatch: {width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  auto: {color: CLUSTER_INK.onSwatch, fontFamily: FONT.black, fontSize: 12},
  checks: {alignSelf: 'center', gap: 14},
  check: {flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140},
  box: {width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: CLUSTER_INK.textFaint, alignItems: 'center', justifyContent: 'center'},
  checkLabel: {color: CLUSTER_INK.text, fontFamily: FONT.bold, fontSize: 13},
});
