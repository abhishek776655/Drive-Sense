import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import {useVehicleStore} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BottomSheet} from '../drive/BottomSheet';
import {ActionButton} from '../ActionButton';

const SCORES: {value: number | null; label: string}[] = [
  {value: null, label: 'Any'},
  {value: 70, label: '70+'},
  {value: 90, label: '90+'},
];

interface FilterSheetProps {
  visible: boolean;
  vehicleId: string | null;
  minScore: number | null;
  onApply: (filters: {vehicleId: string | null; minScore: number | null}) => void;
  onClose: () => void;
}

/** Vehicle and minimum-score filters; the date range comes from the Period chip. */
export function FilterSheet({visible, vehicleId, minScore, onApply, onClose}: FilterSheetProps) {
  const c = useAppTheme().colors;
  const vehicles = useVehicleStore((s) => s.vehicles);
  // Draft until Apply. The parent mounts this only while open, so each opening starts from the current filters.
  const [draftVehicle, setDraftVehicle] = useState(vehicleId);
  const [draftScore, setDraftScore] = useState(minScore);

  const row = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{selected: on}}
      onPress={onPress}
      style={{flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.glassRow}}>
      <Ionicons name="car-sport" size={18} color={c.accent} />
      <AppText size={15} weight="extrabold" style={{flex: 1}}>
        {label}
      </AppText>
      {on ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} title="Filters" onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{gap: 8, marginTop: 8}}>
        <AppText size={12} weight="extrabold" tone="secondary" style={{letterSpacing: 0.8, marginLeft: 4}}>
          VEHICLE
        </AppText>
        {row('all', 'All vehicles', draftVehicle == null, () => setDraftVehicle(null))}
        {vehicles.map((v) => row(v.id, v.display_name, draftVehicle === v.id, () => setDraftVehicle(v.id)))}
        <AppText size={12} weight="extrabold" tone="secondary" style={{letterSpacing: 0.8, marginLeft: 4, marginTop: 10}}>
          MINIMUM SCORE
        </AppText>
        <View style={{flexDirection: 'row', gap: 8}}>
          {SCORES.map((s) => {
            const on = draftScore === s.value;
            return (
              <Pressable
                key={s.label}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                onPress={() => setDraftScore(s.value)}
                style={{flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: on ? c.accentTint : c.glassRow}}>
                <AppText size={15} weight="extrabold" color={on ? c.accent : c.textPrimary}>
                  {s.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 8}}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraftVehicle(null);
              setDraftScore(null);
            }}
            style={{paddingHorizontal: 18, paddingVertical: 14}}>
            <AppText size={15} weight="extrabold" tone="secondary">
              Reset
            </AppText>
          </Pressable>
          <ActionButton
            label="Apply"
            onPress={() => {
              onApply({vehicleId: draftVehicle, minScore: draftScore});
              onClose();
            }}
            style={{flex: 1}}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
