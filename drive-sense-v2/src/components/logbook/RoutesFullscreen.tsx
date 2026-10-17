import {Ionicons} from '@expo/vector-icons';
import {useMemo, useRef, useState} from 'react';
import {Modal, Platform, ScrollView, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useUnits} from '../../hooks/useUnits';
import type {TripRoutePreview} from '../../services/tripService';
import {withAlpha} from '../../theme/color';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {tripTitle} from '../../utils/logbook';
import {formatDriveTime} from '../../utils/summaryFormat';
import {routeRegion} from '../../utils/routeRegion';
import {AppText} from '../AppText';
import {Glass} from '../Glass';
import {GlassButton} from '../GlassButton';
import {MapButton} from '../trip/MapButton';
import {useMapType} from '../../hooks/useMapType';

interface RoutesFullscreenProps {
  visible: boolean;
  routes: TripRoutePreview[];
  onClose: () => void;
  onOpenTrip: (id: string) => void;
}

type LatLng = {latitude: number; longitude: number};

/**
 * Rovy's full-screen routes map: every drive in its own colour, a chip per drive along the bottom.
 * Tapping a chip or a line picks that drive (others fade, the map zooms to it) and offers Open.
 */
export function RoutesFullscreen({visible, routes, onClose, onOpenTrip}: RoutesFullscreenProps) {
  const mapType = useMapType();
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const u = useUnits();
  const mapRef = useRef<MapView>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const palette = [c.accent, c.blue, c.green, c.purple, c.cyan, c.amber, c.red, c.teal];

  const lines = useMemo(
    () => routes.map((r, i) => ({...r, color: palette[i % palette.length], coords: r.points.map(([latitude, longitude]): LatLng => ({latitude, longitude}))})),
    // Palette entries are theme tokens: recompute when the theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routes, c],
  );
  const region = useMemo(() => routeRegion(lines.flatMap((l) => l.coords)), [lines]);
  const pickedLine = lines.find((l) => l.trip_id === picked) ?? null;

  const pick = (id: string | null) => {
    setPicked(id);
    const line = lines.find((l) => l.trip_id === id);
    const target = line ? routeRegion(line.coords) : region;
    if (target) {
      mapRef.current?.animateToRegion(target, 450);
    }
  };
  const close = () => {
    setPicked(null);
    onClose();
  };
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})} at ${d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}`;
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
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
            showsPointsOfInterests={false}
            initialRegion={region}
            onPress={() => pickedLine && pick(null)}>
            {/* Oldest first so the newest drive sits on top; the picked one always on top. */}
            {[...lines].reverse().map((line) => {
              const dim = pickedLine != null && line.trip_id !== pickedLine.trip_id;
              return (
                <Polyline
                  key={line.trip_id}
                  coordinates={line.coords}
                  strokeColor={dim ? withAlpha(line.color, 0.25) : line.color}
                  strokeWidth={line.trip_id === picked ? 6 : 4}
                  zIndex={line.trip_id === picked ? 2 : 1}
                  lineCap="round"
                  lineJoin="round"
                  tappable
                  onPress={() => pick(line.trip_id)}
                />
              );
            })}
            {pickedLine ? (
              <Marker coordinate={pickedLine.coords[0]} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={3}>
                <View style={{width: 14, height: 14, borderRadius: 7, backgroundColor: c.green, borderWidth: 3, borderColor: c.onAccent}} />
              </Marker>
            ) : null}
          </MapView>
        ) : null}

        <View style={{position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <Glass radius={18} style={{flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 12, paddingRight: 6}}>
            <Ionicons name="map" size={13} color={c.accent} />
            <AppText size={13} weight="black">
              Your Routes
            </AppText>
            <View style={{minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: c.control}}>
              <AppText size={11} weight="black" tone="secondary">
                {routes.length}
              </AppText>
            </View>
          </Glass>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            {pickedLine ? (
              <GlassButton accessibilityLabel="Show all routes" onPress={() => pick(null)} radius={18} style={{height: 36, paddingHorizontal: 14}}>
                <AppText size={12} weight="black" tone="accent">
                  Show All
                </AppText>
              </GlassButton>
            ) : null}
            <MapButton icon="close" label="Close routes map" onPress={close} size={38} />
          </View>
        </View>

        <View style={{position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 8, gap: 10}}>
          {pickedLine ? (
            <View style={{paddingHorizontal: 16}}>
              <Glass radius={26} style={{padding: 16}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                  <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: pickedLine.color}} />
                  <View style={{flex: 1}}>
                    <AppText size={17} weight="black" numberOfLines={1}>
                      {tripTitle(pickedLine)}
                    </AppText>
                    <AppText size={12} weight="semibold" tone="secondary">
                      {when(pickedLine.start_time)}
                    </AppText>
                  </View>
                  <GlassButton
                    accessibilityLabel="View drive"
                    onPress={() => {
                      const id = pickedLine.trip_id;
                      close();
                      onOpenTrip(id);
                    }}
                    tint={withAlpha(c.accent, 0.85)}
                    radius={18}
                    style={{flexDirection: 'row', gap: 3, height: 30, paddingHorizontal: 12}}>
                    <AppText size={13} weight="black" tone="onAccent">
                      View
                    </AppText>
                    <Ionicons name="chevron-forward" size={13} color={c.onAccent} />
                  </GlassButton>
                </View>
                <View style={{height: 1, backgroundColor: c.separator, marginVertical: 12}} />
                <View style={{flexDirection: 'row'}}>
                  {[
                    {label: 'DISTANCE', value: u.distance(pickedLine.distance_meters), unit: u.distanceUnit},
                    {label: 'TIME', value: formatDriveTime(pickedLine.duration_seconds), unit: ''},
                    {label: 'TOP SPEED', value: u.speed(pickedLine.max_speed_mps), unit: u.speedUnit},
                  ].map((stat) => (
                    <View key={stat.label} style={{flex: 1, gap: 2}}>
                      <AppText size={9} weight="extrabold" tone="tertiary" style={{letterSpacing: 1}}>
                        {stat.label}
                      </AppText>
                      <AppText size={18} weight="black">
                        {stat.value}
                        {stat.unit ? (
                          <AppText size={12} weight="bold" tone="secondary">
                            {' '}
                            {stat.unit}
                          </AppText>
                        ) : null}
                      </AppText>
                    </View>
                  ))}
                </View>
              </Glass>
            </View>
          ) : (
            <View style={{alignItems: 'center', paddingHorizontal: 16}}>
              <Glass radius={16} style={{height: 32, paddingHorizontal: 14, justifyContent: 'center'}}>
                <AppText size={12} weight="bold" tone="secondary">
                  Tap a route, or pick a drive below
                </AppText>
              </Glass>
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingHorizontal: 16}}>
            {lines.map((line) => {
              const on = line.trip_id === picked;
              return (
                <GlassButton
                  key={line.trip_id}
                  accessibilityLabel={`Drive on ${day(line.start_time)}, ${u.distance(line.distance_meters)} ${u.distanceUnit}`}
                  accessibilityState={{selected: on}}
                  onPress={() => pick(on ? null : line.trip_id)}
                  tint={on ? withAlpha(line.color, 0.85) : undefined}
                  radius={18}
                  style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 11, paddingRight: 14}}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: on ? undefined : line.color,
                      borderWidth: on ? 2 : 0,
                      borderColor: c.onAccent,
                    }}
                  />
                  <View>
                    <AppText size={12} weight="black" color={on ? c.onAccent : undefined}>
                      {day(line.start_time)}
                    </AppText>
                    <AppText size={11} weight="bold" color={on ? withAlpha(c.onAccent, 0.85) : c.textSecondary}>
                      {u.distance(line.distance_meters)} {u.distanceUnit}
                    </AppText>
                  </View>
                </GlassButton>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
