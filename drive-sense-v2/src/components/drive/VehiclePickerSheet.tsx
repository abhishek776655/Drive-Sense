import {Ionicons} from '@expo/vector-icons';
import {Pressable, ScrollView, View} from 'react-native';
import {useVehicleStore} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BottomSheet} from './BottomSheet';

/**
 * Pick a vehicle. Without `onPick` it sets the active vehicle (Drive); with it, it reports the
 * choice and marks `selectedId` (changing a past trip's vehicle).
 */
export function VehiclePickerSheet({
  visible,
  onClose,
  selectedId,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  selectedId?: string | null;
  onPick?: (vehicleId: string) => void;
}) {
  const theme = useAppTheme();
  const {vehicles, activeVehicleId, setActive, error} = useVehicleStore();
  const current = onPick ? (selectedId ?? null) : activeVehicleId;
  return (
    <BottomSheet visible={visible} title="Vehicle" onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{gap: 6, marginTop: 8, marginBottom: 8}}>
        {error ? (
          <AppText size={13} weight="semibold" tone="secondary">
            {error}
          </AppText>
        ) : null}
        {!error && vehicles.length === 0 ? (
          <AppText size={13} weight="semibold" tone="secondary">
            No vehicles yet. Add one in Garage.
          </AppText>
        ) : null}
        {vehicles.map((vehicle) => {
          const on = vehicle.id === current;
          return (
            <Pressable
              key={vehicle.id}
              accessibilityRole="button"
              accessibilityState={{selected: on}}
              onPress={() => {
                if (onPick) {
                  onPick(vehicle.id);
                } else {
                  void setActive(vehicle.id);
                }
                onClose();
              }}
              style={{flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: theme.colors.glassRow}}>
              <Ionicons name="car-sport" size={20} color={theme.colors.accent} />
              <View style={{flex: 1}}>
                <AppText size={15} weight="extrabold">
                  {vehicle.display_name}
                </AppText>
                {vehicle.plate_number ? (
                  <AppText size={12} weight="semibold" tone="secondary">
                    {vehicle.plate_number}
                  </AppText>
                ) : null}
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
