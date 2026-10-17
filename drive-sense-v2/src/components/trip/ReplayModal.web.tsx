import {Modal, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {MapButton} from './MapButton';
import type {ReplayModalProps} from './ReplayModal.types';
import {TripRouteMap} from './TripRouteMap';

/** Web stand-in: the route without playback (the replay needs the native map's camera). */
export function ReplayModal({visible, onClose, points, events}: ReplayModalProps) {
  const c = useAppTheme().colors;
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <TripRouteMap points={points} events={events} />
        <View style={{position: 'absolute', top: 16, left: 16}}>
          <MapButton icon="close" label="Close replay" onPress={onClose} size={44} />
        </View>
      </View>
    </Modal>
  );
}
