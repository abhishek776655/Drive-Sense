import {View} from 'react-native';
import type {Vehicle} from '../../services/vehicleService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {vehiclePills} from '../../utils/garage';
import {AppText} from '../AppText';
import {DashedOutline} from './DashedOutline';
import {VehicleIcon} from './VehicleIcon';
import {VehiclePhoto} from './VehiclePhoto';
import {ActionButton} from '../ActionButton';

const RADIUS = 32;

interface VehicleHeroCardProps {
  vehicle: Vehicle;
  uploading: boolean;
  onPhoto: () => void;
}

/** Rovy's photo slot: dashed outline, the photo (or glyph in a tinted circle), name, tags, photo button. */
export function VehicleHeroCard({vehicle, uploading, onPhoto}: VehicleHeroCardProps) {
  const c = useAppTheme().colors;
  const hasPhoto = vehicle.photo_url != null;
  return (
    <View style={{borderRadius: RADIUS, alignItems: 'center', paddingTop: hasPhoto ? 14 : 34, paddingBottom: 26, paddingHorizontal: hasPhoto ? 14 : 20, gap: 14}}>
      <DashedOutline radius={RADIUS} color={withAlpha(c.textTertiary, 0.32)} />
      {hasPhoto ? (
        <VehiclePhoto path={vehicle.photo_url!} height={210} radius={RADIUS - 12} />
      ) : (
        <View style={{width: 112, height: 112, borderRadius: 56, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 10}}>
          <VehicleIcon type={vehicle.vehicle_type} size={66} color={c.accent} />
        </View>
      )}
      <AppText size={24} weight="black" numberOfLines={1} adjustsFontSizeToFit style={{textAlign: 'center', marginTop: hasPhoto ? 4 : 0}}>
        {vehicle.display_name}
      </AppText>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8}}>
        {vehiclePills(vehicle).map((pill) => (
          <View key={pill} style={{backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 4}}>
            <AppText size={13} weight="bold" tone="secondary">
              {pill}
            </AppText>
          </View>
        ))}
      </View>
      <ActionButton glass={false} variant="soft" icon="camera" label={hasPhoto ? 'Change photo' : 'Add photo'} onPress={onPhoto} busy={uploading} height={40} size={15} style={{marginTop: 8}} />
    </View>
  );
}
