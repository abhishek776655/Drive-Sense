import {Ionicons} from '@expo/vector-icons';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Modal, Platform, Pressable, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useUnits} from '../../hooks/useUnits';
import {withAlpha} from '../../theme/color';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatClock, formatG} from '../../utils/format';
import {lookAhead, normalizeHeading} from '../../utils/heading';
import {routeRegion} from '../../utils/routeRegion';
import {buildReplay, MAP_POINTS, replayAt, speedSegments, thin} from '../../utils/tripAnalysis';
import {kmhInUnits} from '../../utils/units';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {GlassButton} from '../GlassButton';
import {EventMarker} from '../summary/EventMarker';
import {MapButton} from './MapButton';
import {CarMarker, FinishFlag, StartFlag} from './RouteMarkers';
import type {ReplayModalProps} from './ReplayModal.types';
import {useMapType} from '../../hooks/useMapType';

/** 1× is real time (the drive as it happened, pauses squeezed out); the rest fast-forward. */
const SPEEDS = [1, 2, 4, 8, 16, 32];
/** Follow mode: a 3D chase camera like the live Drive map — tilted, facing the way the car drives, looking a little ahead. */
const FOLLOW_PITCH = 55;
const FOLLOW_ZOOM = 17;
const FOLLOW_ALTITUDE_M = 700;
const FOLLOW_AHEAD_M = 40;
/** Switching to Follow: the camera flies down to the car over this long, then the replay plays. */
const FOLLOW_FLY_MS = 800;
/** The clock re-renders the screen at most this often (about 30 fps), which keeps the map smooth. */
const FRAME_MS = 33;
/** Clear of the top buttons (close, Follow / Overview, Events). */
const TOP_BAR_PT = 76;

type View_ = 'follow' | 'overview';

/** Rovy-style drive replay: the car retraces the route while the route fills in with speed colours. */
export function ReplayModal({visible, onClose, points, events}: ReplayModalProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const u = useUnits();
  const mapRef = useRef<MapView>(null);
  const track = useMemo(() => buildReplay(thin(points, MAP_POINTS)), [points]);
  const route = useMemo(() => track.points.map((p) => ({latitude: p.latitude, longitude: p.longitude})), [track]);
  const region = useMemo(() => routeRegion(route), [route]);

  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<View_>('overview');
  const [showEvents, setShowEvents] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);
  // True while the camera flies down to the car after Follow is tapped; the chase waits for it.
  const [arriving, setArriving] = useState(false);
  const arrival = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frame = replayAt(track, ms);
  const index = frame?.index ?? 0;
  const driven = useMemo(() => speedSegments(track.points.slice(0, index + 2), c), [track, index, c]);

  // Every opening starts at the beginning, paused on the whole route; Play starts it.
  const onShow = () => {
    setMs(0);
    setMode('overview');
    setPlaying(false);
  };
  const close = () => {
    setPlaying(false);
    onClose();
  };

  // Playback clock.
  useEffect(() => {
    if (!playing) {
      return;
    }
    let raf = 0;
    let prev = Date.now();
    const tick = () => {
      const now = Date.now();
      if (now - prev < FRAME_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const step = (now - prev) * speed;
      prev = now;
      setMs((m) => {
        const next = m + step;
        if (next >= track.durationMs) {
          setPlaying(false);
          return track.durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, track.durationMs]);

  // Follow: the camera sits on the car every replay frame (the clock already runs at ~30 fps and the
  // camera heading is smoothed along the route), so it keeps up instead of trailing behind.
  useEffect(() => {
    if (mode !== 'follow' || arriving || !frame) {
      return;
    }
    const here = {latitude: frame.latitude, longitude: frame.longitude};
    const heading = frame.cameraHeading ?? 0;
    mapRef.current?.setCamera({center: lookAhead(here, heading, FOLLOW_AHEAD_M), heading, pitch: FOLLOW_PITCH, zoom: FOLLOW_ZOOM, altitude: FOLLOW_ALTITUDE_M});
  }, [mode, arriving, frame]);

  // A pending fly-in never fires after the replay closes.
  useEffect(() => () => {
    if (arrival.current) {
      clearTimeout(arrival.current);
    }
  }, []);

  const chooseMode = (picked: View_) => {
    // Follow is a toggle: tapping it again goes back to the normal (overview) map.
    const next: View_ = picked === 'follow' && mode === 'follow' ? 'overview' : picked;
    if (arrival.current) {
      clearTimeout(arrival.current);
      arrival.current = null;
    }
    setArriving(false);
    setMode(next);
    if (next === 'follow' && frame) {
      // Pause, fly down to the car, then play from there.
      setPlaying(false);
      setArriving(true);
      const here = {latitude: frame.latitude, longitude: frame.longitude};
      const heading = frame.cameraHeading ?? 0;
      mapRef.current?.animateCamera(
        {center: lookAhead(here, heading, FOLLOW_AHEAD_M), heading, pitch: FOLLOW_PITCH, zoom: FOLLOW_ZOOM, altitude: FOLLOW_ALTITUDE_M},
        {duration: FOLLOW_FLY_MS},
      );
      arrival.current = setTimeout(() => {
        arrival.current = null;
        setArriving(false);
        if (ms >= track.durationMs) {
          setMs(0);
        }
        setPlaying(true);
      }, FOLLOW_FLY_MS + 50);
      return;
    }
    if (next === 'overview' && region) {
      // Flatten and turn north first, then fit the whole route.
      mapRef.current?.animateCamera({heading: 0, pitch: 0}, {duration: 300});
      setTimeout(() => mapRef.current?.animateToRegion(region, 500), 320);
    }
  };

  // Normal view: + and − step the zoom (pinch works too). Apple Maps zooms by camera altitude.
  const zoomBy = async (factor: number) => {
    const camera = await mapRef.current?.getCamera();
    if (!camera) {
      return;
    }
    mapRef.current?.animateCamera(
      Platform.OS === 'ios' && camera.altitude != null ? {altitude: camera.altitude / factor} : {zoom: (camera.zoom ?? 14) + Math.log2(factor)},
      {duration: 250},
    );
  };

  const seek = (x: number) => {
    if (trackWidth > 0) {
      setMs(Math.min(1, Math.max(0, x / trackWidth)) * track.durationMs);
    }
  };
  const togglePlay = () => {
    if (ms >= track.durationMs) {
      setMs(0);
    }
    setPlaying((p) => !p);
  };
  const progress = track.durationMs > 0 ? ms / track.durationMs : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onShow={onShow} onRequestClose={close}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        {region ? (
          <MapView
            mapType={mapType}
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            userInterfaceStyle={theme.scheme}
            customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            // iOS puts the compass top right, under the Events button: move it below the top bar.
            compassOffset={{x: 0, y: TOP_BAR_PT}}
            showsPointsOfInterests={false}
            showsBuildings
            initialRegion={region}
            onPanDrag={() => mode === 'follow' && setMode('overview')}>
            <Polyline coordinates={route} strokeColor={withAlpha(c.accent, 0.35)} strokeWidth={5} lineCap="round" lineJoin="round" />
            {driven.map((line) => (
              <Polyline key={line.key} coordinates={line.coords} strokeColor={line.color} strokeWidth={6} lineCap="round" lineJoin="round" zIndex={2} />
            ))}
            {(showEvents ? events : []).map((event) => (
              <Marker key={event.id} coordinate={event} title={event.title} description={event.description} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={3}>
                <EventMarker kind={event.kind} />
              </Marker>
            ))}
            <Marker coordinate={route[0]} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
              <StartFlag />
            </Marker>
            {route.length > 1 ? (
              <Marker coordinate={route[route.length - 1]} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
                <FinishFlag />
              </Marker>
            ) : null}
            {frame ? (
              // The arrow turns with the car, so this marker re-renders its view.
              <Marker coordinate={{latitude: frame.latitude, longitude: frame.longitude}} anchor={{x: 0.5, y: 0.5}} tracksViewChanges zIndex={5}>
                {/* Follow: an arrow for the direction of travel, as the turning camera sees it. Overview: a plain dot. */}
                <CarMarker
                  dot={mode !== 'follow'}
                  heading={frame.heading == null ? null : normalizeHeading(frame.heading - (mode === 'follow' ? (frame.cameraHeading ?? 0) : 0))}
                />
              </Marker>
            ) : null}
          </MapView>
        ) : null}

        <View style={{position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
          <MapButton icon="close" label="Close replay" onPress={close} size={44} />
          <Glass interactive radius={17} style={{flexDirection: 'row', height: 34, padding: 3}}>
            {(['follow', 'overview'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                  onPress={() => chooseMode(m)}
                  style={{flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: on ? c.accentTint : undefined}}>
                  <Ionicons name={m === 'follow' ? 'navigate-circle' : 'map'} size={13} color={on ? c.accent : c.textSecondary} />
                  <AppText size={12} weight="extrabold" color={on ? c.accent : c.textSecondary}>
                    {m === 'follow' ? 'Follow' : 'Overview'}
                  </AppText>
                </Pressable>
              );
            })}
          </Glass>
          {events.length > 0 ? (
            <GlassButton
              accessibilityRole="switch"
              accessibilityState={{checked: showEvents}}
              accessibilityLabel="Events on map"
              onPress={() => setShowEvents((v) => !v)}
              fill={showEvents ? c.accentTint : undefined}
              style={{flexDirection: 'row', gap: 4, height: 34, paddingHorizontal: 10}}>
              <Ionicons name={showEvents ? 'flag' : 'flag-outline'} size={13} color={showEvents ? c.accent : c.textSecondary} />
              <AppText size={12} weight="extrabold" color={showEvents ? c.accent : c.textSecondary}>
                Events
              </AppText>
            </GlassButton>
          ) : (
            <View style={{width: 44}} />
          )}
        </View>

        {mode === 'overview' ? (
          <View style={{position: 'absolute', right: 16, top: insets.top + 8 + TOP_BAR_PT + 56, gap: 10}}>
            <MapButton icon="add" label="Zoom in" onPress={() => void zoomBy(2)} size={44} />
            <MapButton icon="remove" label="Zoom out" onPress={() => void zoomBy(0.5)} size={44} />
          </View>
        ) : null}

        <View style={{position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 12, gap: 10}}>
          <Glass radius={26} style={{flexDirection: 'row', paddingVertical: 14}}>
            {[
              {value: String(kmhInUnits(frame?.kmh ?? 0, u.units)), unit: u.speedUnit, label: 'Speed'},
              {value: (u.distanceValue(frame?.meters ?? 0) ?? 0).toFixed(2), unit: u.distanceUnit, label: 'Distance'},
              {value: formatG(Math.abs(frame?.g ?? 0)), unit: 'g', label: 'G-Force'},
            ].map((s) => (
              <View key={s.label} style={{flex: 1, alignItems: 'center'}}>
                <AppText size={28} weight="black" style={{fontVariant: ['tabular-nums']}}>
                  {s.value}
                  <AppText size={12} weight="bold" tone="secondary">
                    {' '}
                    {s.unit}
                  </AppText>
                </AppText>
                <AppText size={13} weight="bold" tone="secondary">
                  {s.label}
                </AppText>
              </View>
            ))}
          </Glass>
          <Glass radius={34} style={{flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8}}>
            <GlassButton accessibilityLabel={playing ? 'Pause replay' : 'Play replay'} onPress={togglePlay} tint={withAlpha(c.accent, 0.85)} style={{width: 52, height: 52}}>
              <Ionicons name={playing ? 'pause' : 'play'} size={24} color={c.onAccent} />
            </GlassButton>
            <View style={{flex: 1, gap: 6}}>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel="Replay position"
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  setPlaying(false);
                  seek(e.nativeEvent.locationX);
                }}
                onResponderMove={(e) => seek(e.nativeEvent.locationX)}
                style={{height: 24, justifyContent: 'center'}}>
                <View style={{height: 6, borderRadius: 3, backgroundColor: c.separator}}>
                  <View style={{width: `${progress * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.accent}} />
                </View>
                <View
                  pointerEvents="none"
                  style={{position: 'absolute', left: Math.max(0, progress * trackWidth - 8), width: 16, height: 16, borderRadius: 8, backgroundColor: c.onAccent, borderWidth: 3, borderColor: c.accent}}
                />
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <AppText size={12} weight="bold" tone="secondary" style={{fontVariant: ['tabular-nums']}}>
                  {formatClock(ms / 1000)}
                </AppText>
                <AppText size={12} weight="bold" tone="secondary" style={{fontVariant: ['tabular-nums']}}>
                  {formatClock(track.durationMs / 1000)}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Replay speed ${speed} times`}
              onPress={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
              hitSlop={8}
              style={{minWidth: 40, height: 32, borderRadius: 16, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint, marginRight: 4}}>
              <AppText size={13} weight="black" tone="accent">
                {speed}×
              </AppText>
            </Pressable>
          </Glass>
        </View>
      </View>
    </Modal>
  );
}
