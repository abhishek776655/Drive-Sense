import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Modal, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {GlassButton} from '../GlassButton';
import {MapButton} from './MapButton';
import {TripRouteMap} from './TripRouteMap';
import type {LatLng, TripRouteMapProps} from './TripRouteMap.types';

interface RouteFullscreenProps {
  visible: boolean;
  onClose: () => void;
  points: TripRouteMapProps['points'];
  events: TripRouteMapProps['events'];
  focus?: LatLng | null;
  showEvents: boolean;
  onToggleEvents: () => void;
}

/** Full-screen route: pan and zoom, a heatmap (speed colours) toggle and Events on / off, as in Rovy. */
export function RouteFullscreen({visible, onClose, points, events, focus = null, showEvents, onToggleEvents}: RouteFullscreenProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  // Heatmap = the route coloured by speed; off draws it plain.
  const [heatmap, setHeatmap] = useState(true);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <TripRouteMap points={points} events={events} mode={heatmap ? 'speed' : 'plain'} interactive focus={focus} legendStyle={{left: 16, bottom: insets.bottom + 44}} showEvents={showEvents} />
        <View style={{position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8}}>
          <MapButton icon="close" label="Close map" onPress={onClose} size={44} />
          <View style={{alignItems: 'flex-end', gap: 12}}>
          {events.length > 0 ? (
            <GlassButton
              accessibilityRole="switch"
              accessibilityState={{checked: showEvents}}
              accessibilityLabel="Events on map"
              onPress={onToggleEvents}
              fill={showEvents ? c.accentTint : undefined}
              style={{flexDirection: 'row', gap: 4, height: 34, paddingHorizontal: 10}}>
              <Ionicons name={showEvents ? 'flag' : 'flag-outline'} size={13} color={showEvents ? c.accent : c.textSecondary} />
              <AppText size={12} weight="extrabold" color={showEvents ? c.accent : c.textSecondary}>
                Events
              </AppText>
            </GlassButton>
          ) : null}
          <GlassButton
            accessibilityRole="switch"
            accessibilityState={{checked: heatmap}}
            accessibilityLabel="Speed heatmap"
            onPress={() => setHeatmap((v) => !v)}
            fill={heatmap ? c.accentTint : undefined}
            style={{width: 44, height: 44}}>
            <Ionicons name={heatmap ? 'map' : 'map-outline'} size={20} color={heatmap ? c.accent : c.textSecondary} />
          </GlassButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}
