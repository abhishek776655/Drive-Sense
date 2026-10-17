import {Ionicons} from '@expo/vector-icons';
import {useState, type ReactNode} from 'react';
import {Alert, Modal, Pressable, ScrollView, TextInput, View, type TextInputProps} from 'react-native';
import type {Vehicle, VehicleInput, VehicleType} from '../../services/vehicleService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {makesFor, modelsFor} from '../../data/vehicleCatalog';
import {draftFromVehicle, emptyDraft, FUEL_OPTIONS, inputFromDraft, vehicleNoun, type VehicleDraft} from '../../utils/garage';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {GlassButton} from '../GlassButton';
import {PickerField} from './PickerField';
import {PillChoice} from '../settings/SettingsRows';
import {VehicleIcon} from './VehicleIcon';

const TYPES: VehicleType[] = ['car', 'motorbike'];

interface VehicleSheetProps {
  /** Edit this vehicle; without one the sheet adds a new vehicle. */
  vehicle?: Vehicle | null;
  onSave: (input: VehicleInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const withOwn = (options: string[], own: string | undefined) => (own && !options.includes(own) ? [...options, own].sort((a, b) => a.localeCompare(b)) : options);

function Label({children}: {children: ReactNode}) {
  return (
    <AppText size={16} weight="bold" tone="secondary" style={{marginLeft: 16, marginTop: 22, marginBottom: 10}}>
      {children}
    </AppText>
  );
}

function Field(props: TextInputProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <TextInput
      placeholderTextColor={c.textTertiary}
      selectionColor={c.accent}
      {...props}
      style={[{height: 52, borderRadius: 99, paddingHorizontal: 18, backgroundColor: c.card, color: c.textPrimary, fontFamily: theme.font.semibold, fontSize: 17}, props.style]}
    />
  );
}

/**
 * Rovy's Add Car sheet as an iOS page sheet: Cancel and Add in glass, vehicle type, name, make,
 * model, year and HP, fuel. The parent mounts it only while open, so each opening starts fresh.
 */
export function VehicleSheet({vehicle, onSave, onDelete, onClose}: VehicleSheetProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState<VehicleDraft>(() => (vehicle ? draftFromVehicle(vehicle) : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = vehicle != null;
  const patch = (next: Partial<VehicleDraft>) => setDraft((d) => ({...d, ...next}));
  const ready = draft.make.trim() !== '' && draft.model.trim() !== '';
  // The catalog, plus the vehicle's own make and model when editing one that predates it.
  const own = vehicle && vehicle.vehicle_type === draft.vehicle_type ? vehicle : null;
  const makeOptions = withOwn(makesFor(draft.vehicle_type), own?.company_name);
  const modelOptions = withOwn(modelsFor(draft.vehicle_type, draft.make), own && own.company_name === draft.make ? own.model_name : undefined);

  const pickType = (type: VehicleType) => {
    const ownMake = vehicle && vehicle.vehicle_type === type ? vehicle.company_name : undefined;
    // A make from the other list (a car make on a motorbike) does not carry over.
    const keep = withOwn(makesFor(type), ownMake).includes(draft.make);
    patch(keep ? {vehicle_type: type} : {vehicle_type: type, make: '', model: ''});
  };

  const save = async () => {
    const result = inputFromDraft(draft);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      await onSave(result.input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the vehicle.');
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!onDelete) {
      return;
    }
    Alert.alert(`Delete ${vehicle?.display_name ?? 'vehicle'}?`, 'Its drives are deleted with it. This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete();
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete the vehicle.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12}}>
          <GlassButton accessibilityLabel="Cancel" onPress={onClose} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="bold" tone="accent">
              Cancel
            </AppText>
          </GlassButton>
          <AppText size={17} weight="extrabold">
            {editing ? 'Edit' : `Add ${vehicleNoun(draft.vehicle_type)}`}
          </AppText>
          <GlassButton accessibilityLabel={editing ? 'Save' : 'Add'} onPress={() => void save()} disabled={!ready || saving} style={{height: 44, paddingHorizontal: 18}}>
            <AppText size={17} weight="extrabold" tone="accent">
              {editing ? 'Save' : 'Add'}
            </AppText>
          </GlassButton>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 40}}>
          {error ? (
            <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12, marginTop: 8}}>
              <AppText size={13} weight="bold" tone="accent">
                {error}
              </AppText>
            </View>
          ) : null}

          <Label>Vehicle type</Label>
          <View style={{flexDirection: 'row', gap: 12}}>
            {TYPES.map((type) => {
              const on = draft.vehicle_type === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="radio"
                  accessibilityLabel={vehicleNoun(type)}
                  accessibilityState={{selected: on}}
                  onPress={() => pickType(type)}
                  style={({pressed}) => ({
                    flex: 1,
                    height: 52,
                    borderRadius: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    backgroundColor: on ? c.accent : c.glassRow,
                    borderWidth: 1,
                    borderColor: on ? c.accent : c.separator,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <VehicleIcon type={type} size={22} color={on ? c.onAccent : c.textPrimary} />
                  <AppText size={16} weight="extrabold" color={on ? c.onAccent : c.textPrimary}>
                    {vehicleNoun(type)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <Label>Name (optional)</Label>
          <Field value={draft.nickname} onChangeText={(nickname) => patch({nickname})} placeholder="e.g. Black Beauty" maxLength={120} returnKeyType="next" />
          <Label>Make</Label>
          {/* Keyed by type and make, so a changed list starts the field afresh. */}
          <PickerField
            key={`make-${draft.vehicle_type}-${draft.make === '' ? 'none' : 'set'}`}
            value={draft.make}
            options={makeOptions}
            onChange={(make) => patch(make === draft.make ? {make} : {make, model: ''})}
            placeholder="Make"
            accessibilityLabel="Make"
          />
          <Label>Model</Label>
          <PickerField
            key={`model-${draft.vehicle_type}-${draft.make}`}
            value={draft.model}
            options={modelOptions}
            onChange={(model) => patch({model})}
            placeholder={draft.make ? 'Model' : 'Pick a make first'}
            disabled={!draft.make}
            accessibilityLabel="Model"
          />

          <Label>Details</Label>
          <Card style={{borderRadius: 26, paddingHorizontal: 18}}>
            {(
              [
                {key: 'year', label: 'Year', placeholder: String(new Date().getFullYear())},
                {key: 'horsepower', label: 'HP', placeholder: '0'},
              ] as const
            ).map((row, i) => (
              <View key={row.key} style={{flexDirection: 'row', alignItems: 'center', height: 52, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.separator}}>
                <AppText size={17} weight="semibold" style={{flex: 1}}>
                  {row.label}
                </AppText>
                <TextInput
                  value={draft[row.key]}
                  onChangeText={(text) => patch({[row.key]: text.replace(/[^0-9]/g, '')})}
                  placeholder={row.placeholder}
                  placeholderTextColor={c.textTertiary}
                  selectionColor={c.accent}
                  keyboardType="number-pad"
                  textContentType="none"
                  autoComplete="off"
                  maxLength={4}
                  accessibilityLabel={row.label}
                  style={{minWidth: 80, textAlign: 'right', color: c.textPrimary, fontFamily: theme.font.semibold, fontSize: 17}}
                />
              </View>
            ))}
          </Card>

          <Label>Fuel</Label>
          <Card style={{borderRadius: 26, padding: 14}}>
            <PillChoice stretch options={FUEL_OPTIONS} value={draft.fuel_type} onChange={(fuel_type) => patch({fuel_type})} />
          </Card>

          {editing && onDelete ? (
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={{marginTop: 32}}>
              {({pressed}) => (
                <Card style={{height: 52, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.7 : 1}}>
                  <Ionicons name="trash" size={17} color={c.red} />
                  <AppText size={16} weight="extrabold" color={c.red}>
                    Delete vehicle
                  </AppText>
                </Card>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
