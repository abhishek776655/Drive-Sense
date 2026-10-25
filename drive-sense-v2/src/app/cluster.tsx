import {Ionicons} from '@expo/vector-icons';
import {useKeepAwake} from 'expo-keep-awake';
import {router} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {accentColor, CLUSTER_ACCENTS, CLUSTER_INK, type ClusterAccent} from '../cluster/accents';
import {CLUSTER_LAYOUTS, layoutById} from '../cluster/layouts';
import {useClusterData} from '../cluster/useClusterData';
import {useDriveSettingsStore} from '../stores/driveSettingsStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore} from '../stores/recordingStore';
import {FONT} from '../theme/theme';
import {useBarometerFeed} from '../tracking/useBarometerFeed';
import {useLocationFeed} from '../tracking/useLocationFeed';

/** Controls show on a tap and fade away after this. */
const CHROME_MS = 3000;

/**
 * Cluster mode (spec 2026-10-25): a full-screen landscape digital cluster. Everything on screen is
 * the layout; a tap shows a thin row to close it, switch layout and pick the glow colour.
 */
export default function ClusterScreen() {
  useKeepAwake();
  // The tabs only run GPS on Drive or while a drive is live; the cluster needs it for its map and
  // speed, and so a drive can auto-start from here. A live drive already has its own feed.
  const live = useRecordingStore((s) => s.status !== 'ready');
  useLocationFeed(!live);
  useBarometerFeed(!live);
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const d = useClusterData();
  const layoutId = usePreferencesStore((s) => s.clusterLayout);
  const accentId = usePreferencesStore((s) => s.clusterAccent);
  const setPrefs = usePreferencesStore((s) => s.set);
  const driveAccent = useDriveSettingsStore((s) => s.gaugeAccent);
  const accent = accentColor(accentId, driveAccent);
  const layout = layoutById(layoutId);

  const chrome = useSharedValue(0);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chromeOn, setChromeOn] = useState(false);
  const showChrome = () => {
    chrome.set(withTiming(1, {duration: 200}));
    setChromeOn(true);
    if (hide.current) {
      clearTimeout(hide.current);
    }
    hide.current = setTimeout(() => {
      chrome.set(withTiming(0, {duration: 400}));
      setChromeOn(false);
    }, CHROME_MS);
  };
  useEffect(
    () => () => {
      if (hide.current) {
        clearTimeout(hide.current);
      }
    },
    [],
  );
  const chromeStyle = useAnimatedStyle(() => ({opacity: chrome.value}));

  // Landscape: the long side is the width. Until the rotation lands, draw nothing rather than squash.
  const landscape = width > height;
  const areaW = width - Math.max(insets.left, insets.right) * 2 - 16;
  const areaH = height - insets.top - insets.bottom - 8;
  const Layout = layout.Component;
  const nextLayout = () => {
    const i = CLUSTER_LAYOUTS.findIndex((l) => l.id === layout.id);
    void setPrefs({clusterLayout: CLUSTER_LAYOUTS[(i + 1) % CLUSTER_LAYOUTS.length].id});
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Pressable style={styles.fill} onPress={showChrome} accessibilityLabel="Show cluster controls">
        <View style={[styles.fill, styles.centre]}>{landscape ? <Layout d={d} width={areaW} height={areaH} accent={accent} /> : null}</View>
      </Pressable>
      <Animated.View pointerEvents={chromeOn ? 'box-none' : 'none'} style={[styles.chrome, {top: insets.top + 6, left: Math.max(insets.left, 16), right: Math.max(insets.right, 16)}, chromeStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close cluster" onPress={() => router.back()} style={styles.chip} hitSlop={8}>
          <Ionicons name="close" size={18} color={CLUSTER_INK.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Layout ${layout.name}, change`} onPress={nextLayout} style={[styles.chip, styles.layoutChip]}>
          <Ionicons name="grid" size={14} color={CLUSTER_INK.textDim} />
          <Text style={styles.chipText}>{layout.name}</Text>
        </Pressable>
        <View style={styles.accents}>
          {(['auto', ...Object.keys(CLUSTER_ACCENTS)] as ClusterAccent[]).map((id) => {
            const color = accentColor(id, driveAccent);
            const on = id === accentId;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={id === 'auto' ? 'Accent: same as speedometer' : `Accent ${id}`}
                accessibilityState={{selected: on}}
                onPress={() => {
                  void setPrefs({clusterAccent: id});
                  showChrome();
                }}
                hitSlop={6}
                style={[styles.swatch, {backgroundColor: color, borderColor: on ? CLUSTER_INK.text : 'transparent'}]}>
                {id === 'auto' ? <Text style={styles.auto}>A</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: CLUSTER_INK.background},
  fill: {flex: 1},
  centre: {alignItems: 'center', justifyContent: 'center'},
  chrome: {position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 10},
  chip: {height: 34, minWidth: 34, borderRadius: 17, backgroundColor: CLUSTER_INK.chip, alignItems: 'center', justifyContent: 'center'},
  layoutChip: {flexDirection: 'row', gap: 6, paddingHorizontal: 14},
  chipText: {color: CLUSTER_INK.text, fontFamily: FONT.extrabold, fontSize: 13},
  accents: {flexDirection: 'row', gap: 10, marginLeft: 'auto'},
  swatch: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  auto: {color: CLUSTER_INK.onSwatch, fontFamily: FONT.black, fontSize: 11},
});
