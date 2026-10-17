import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet, View} from 'react-native';
import type {Vehicle} from '../../services/vehicleService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {vehiclePills} from '../../utils/garage';
import {AppText} from '../AppText';
import {DashedOutline} from './DashedOutline';
import {VehicleIcon} from './VehicleIcon';
import {AuthedImage} from '../AuthedImage';
import {GlassButton} from '../GlassButton';
import {Ionicons} from '@expo/vector-icons';
import {ActionButton} from '../ActionButton';

const RADIUS = 32;

interface VehicleHeroCardProps {
  vehicle: Vehicle;
  uploading: boolean;
  onPhoto: () => void;
}

/** Photo height: a 4:3-ish card that the picture fills edge to edge. */
const PHOTO_HEIGHT = 300;

/** The vehicle's photo filling the whole card, with the name and specs over a dark fade at the bottom. */
function PhotoHero({vehicle, uploading, onPhoto}: VehicleHeroCardProps) {
  const c = useAppTheme().colors;
  return (
    <View style={{height: PHOTO_HEIGHT, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: c.card}}>
      <AuthedImage path={vehicle.photo_url!} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(c.photoShade, 0), withAlpha(c.photoShade, 0.35), withAlpha(c.photoShade, 0.78)]}
        locations={[0.35, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{position: 'absolute', top: 14, right: 14}}>
        <GlassButton accessibilityLabel="Change photo" onPress={onPhoto} disabled={uploading} style={{width: 44, height: 44}}>
          <Ionicons name={uploading ? 'hourglass' : 'camera'} size={20} color={c.onPhoto} />
        </GlassButton>
      </View>
      <View style={{position: 'absolute', left: 18, right: 18, bottom: 18, gap: 10}}>
        <AppText size={26} weight="black" color={c.onPhoto} numberOfLines={1} adjustsFontSizeToFit>
          {vehicle.display_name}
        </AppText>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
          {vehiclePills(vehicle).map((pill) => (
            <View key={pill} style={{backgroundColor: withAlpha(c.onPhoto, 0.18), borderRadius: 99, paddingHorizontal: 11, paddingVertical: 4}}>
              <AppText size={13} weight="bold" color={c.onPhoto}>
                {pill}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Rovy's photo slot. With a photo, the picture fills the card and the name and specs sit over it;
 * without one, a dashed outline with the vehicle glyph, name, tags and an Add photo button.
 */
export function VehicleHeroCard({vehicle, uploading, onPhoto}: VehicleHeroCardProps) {
  const c = useAppTheme().colors;
  if (vehicle.photo_url != null) {
    return <PhotoHero vehicle={vehicle} uploading={uploading} onPhoto={onPhoto} />;
  }
  return (
    <View style={{borderRadius: RADIUS, alignItems: 'center', paddingTop: 34, paddingBottom: 26, paddingHorizontal: 20, gap: 14}}>
      <DashedOutline radius={RADIUS} color={withAlpha(c.textTertiary, 0.32)} />
      <View style={{width: 112, height: 112, borderRadius: 56, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 10}}>
        <VehicleIcon type={vehicle.vehicle_type} size={66} color={c.accent} />
      </View>
      <AppText size={24} weight="black" numberOfLines={1} adjustsFontSizeToFit style={{textAlign: 'center'}}>
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
      <ActionButton glass={false} variant="soft" icon="camera" label="Add photo" onPress={onPhoto} busy={uploading} height={40} size={15} style={{marginTop: 8}} />
    </View>
  );
}
