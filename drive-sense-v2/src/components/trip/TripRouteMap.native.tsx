import {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {withAlpha} from '../../theme/color';
import {haversineMeters} from '../../utils/geo';
import {routeRegion} from '../../utils/routeRegion';
import {buildReplay, MAP_POINTS, replayAt, speedSegments, thin, type ReplayFrame} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {ReplayEventCard, type EventFacts} from './ReplayEvents';
import {ReplayEventMarker} from './ReplayEventMarker';
import {MapButton} from './MapButton';
import {FinishFlag, StartFlag} from './RouteMarkers';
import {SpeedLegend} from './SpeedLegend';
import type {TripRouteMapProps} from './TripRouteMap.types';
import {useMapType} from '../../hooks/useMapType';

/** Zoom used when a stop is focused (~350 m across). */
const FOCUS_DELTA = 0.0035;

/** The trip's route coloured by speed, with start/end flags and event markers. */
export function TripRouteMap({points, events, mode = 'speed', interactive = false, focus = null, legendStyle = {left: 12, top: 12}, showEvents = true, onExpand, roughSpots = []}: TripRouteMapProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Slide-up + fade animation for the event card.
  const [cardAnim] = useState(() => new Animated.Value(0));
  const isFirstSelect = useRef(true);

  useEffect(() => {
    if (selectedId == null) {
      // Dismiss: fade + slide down.
      Animated.timing(cardAnim, {toValue: 0, duration: 160, useNativeDriver: true}).start();
      isFirstSelect.current = true;
      return;
    }
    if (isFirstSelect.current) {
      // First appearance: slide up from below.
      isFirstSelect.current = false;
      cardAnim.setValue(0);
      Animated.spring(cardAnim, {toValue: 1, tension: 220, friction: 22, useNativeDriver: true}).start();
    } else {
      // Switching events: quick pop — dip slightly then spring back.
      Animated.sequence([
        Animated.timing(cardAnim, {toValue: 0.6, duration: 80, useNativeDriver: true}),
        Animated.spring(cardAnim, {toValue: 1, tension: 280, friction: 20, useNativeDriver: true}),
      ]).start();
    }
  }, [selectedId, cardAnim]);

  // Slide only, no fade: Liquid Glass draws no edge under a see-through parent (no border on the
  // first tap).
  const cardStyle = {
    transform: [{translateY: cardAnim.interpolate({inputRange: [0, 1], outputRange: [20, 0]})}],
  };

  // Map markers are snapshots: pins redraw for a moment after they appear (and the selected one
  // while selected), so the snapshot never catches them half laid out (off-centre, no ring).
  const settleKey = `${showEvents}-${interactive}-${selectedId}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(settleKey), 900);
    return () => clearTimeout(timer);
  }, [settleKey]);
  const pinsSettled = settledKey === settleKey;

  const routePoints = useMemo(() => thin(points, MAP_POINTS), [points]);
  const route = useMemo(() => routePoints.map((p) => ({latitude: p.latitude, longitude: p.longitude})), [routePoints]);
  const track = useMemo(() => (routePoints.length > 0 ? buildReplay(routePoints) : null), [routePoints]);
  const lines = useMemo(() => (mode === 'speed' ? speedSegments(points, c) : []), [points, mode, c]);
  const region = focus ? {...focus, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA} : routeRegion(route);

  // Snap event markers to the thinned polyline so they sit dead center on the route
  const pins = useMemo(() => {
    return events.map((e) => {
      let lat = e.latitude;
      let lon = e.longitude;
      if (routePoints.length > 0) {
        let best = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < routePoints.length; i++) {
          const pt = routePoints[i];
          const diff = e.at != null ? Math.abs(pt.t - e.at) : haversineMeters(e, pt);
          if (diff < bestDiff) {
            best = i;
            bestDiff = diff;
          }
        }
        lat = routePoints[best].latitude;
        lon = routePoints[best].longitude;
      }
      return {
        ...e,
        latitude: lat,
        longitude: lon,
      };
    });
  }, [events, routePoints]);

  const selected = useMemo(() => pins.find((p) => p.id === selectedId) ?? null, [pins, selectedId]);
  const selectedFacts: EventFacts | null = useMemo(() => {
    if (!selected) {
      return null;
    }
    const realMs = selected.at;
    let at: ReplayFrame | null = null;
    if (track && realMs != null) {
      let best = 0;
      for (let i = 1; i < track.points.length; i++) {
        if (Math.abs(track.points[i].t - realMs) < Math.abs(track.points[best].t - realMs)) {
          best = i;
        }
      }
      at = replayAt(track, track.t[best] ?? 0);
    }
    return {
      kind: selected.kind,
      g: selected.kind === 'top_speed' ? null : (at?.g ?? null),
      kmh: selected.kmh ?? at?.kmh ?? null,
      intensity: selected.intensity ?? null,
      atS: realMs != null && points.length > 0 ? (realMs - points[0].t) / 1000 : null,
    };
  }, [selected, track, points]);

  const jumpTo = () => {
    if (!selected) return;
    mapRef.current?.animateCamera(
      {center: {latitude: selected.latitude, longitude: selected.longitude}, zoom: 16, altitude: 1500},
      {duration: 450},
    );
  };

  if (!region) {
    return (
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center', backgroundColor: c.control}]}>
        <AppText size={14} weight="bold" tone="secondary">
          No route recorded
        </AppText>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        mapType={mapType}
        ref={mapRef}
        // A new focus re-mounts the map so it opens centred there.
        key={focus ? `${focus.latitude},${focus.longitude}` : 'route'}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle={theme.scheme}
        customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        initialRegion={region}
        onPress={(e) => e.nativeEvent.action !== 'marker-press' && setSelectedId(null)}>
        {route.length > 1 ? (
          // Speed mode: a wide pale casing under the coloured lines keeps them readable on any map.
          <Polyline coordinates={route} strokeColor={mode === 'speed' ? c.card : c.accent} strokeWidth={mode === 'speed' ? 9 : 5} lineCap="round" lineJoin="round" />
        ) : null}
        {lines.map((line) => (
          <Polyline key={line.key} coordinates={line.coords} strokeColor={line.color} strokeWidth={5} lineCap="round" lineJoin="round" zIndex={2} />
        ))}
        {roughSpots.map((spot, i) => (
          <Circle
            key={`rough${i}`}
            center={spot}
            radius={14}
            fillColor={withAlpha(spot.level === 'rough' ? c.red : c.amber, 0.6)}
            strokeColor={withAlpha(spot.level === 'rough' ? c.red : c.amber, 0.9)}
            strokeWidth={1}
            zIndex={3}
          />
        ))}
        {(showEvents && interactive ? pins : []).map((pin) => (
          <Marker
            key={`${pin.id}-${pin.id === selectedId ? 'on' : 'off'}`}
            coordinate={pin}
            anchor={{x: 0.5, y: 0.5}}
            centerOffset={{x: 0, y: 0}}
            tracksViewChanges={!pinsSettled || pin.id === selectedId}
            zIndex={pin.id === selectedId ? 6 : 3}
            onPress={() => setSelectedId(pin.id)}>
            <ReplayEventMarker kind={pin.kind} selected={pin.id === selectedId} />
          </Marker>
        ))}
        {start ? (
          <Marker coordinate={start} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <StartFlag />
          </Marker>
        ) : null}
        {end && route.length > 1 ? (
          <Marker coordinate={end} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <FinishFlag />
          </Marker>
        ) : null}
      </MapView>
      {!selectedFacts && mode === 'speed' && route.length > 1 ? (
        <View pointerEvents="none" style={{position: 'absolute', ...legendStyle}}>
          <SpeedLegend />
        </View>
      ) : null}
      {onExpand ? (
        <View style={{position: 'absolute', right: 12, top: 12}}>
          <MapButton icon="expand" label="Open full-screen map" onPress={onExpand} />
        </View>
      ) : null}
      {selectedFacts ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              bottom: interactive ? insets.bottom + 16 : 10,
              left: interactive ? 16 : 10,
              right: interactive ? 16 : 10,
              zIndex: 10,
            },
            cardStyle,
          ]}>
          <ReplayEventCard key={selectedId} facts={selectedFacts} onJump={jumpTo} onClose={() => setSelectedId(null)} />
        </Animated.View>
      ) : null}
    </View>
  );
}
