import {Ionicons} from '@expo/vector-icons';
import {useRef} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import type {Vehicle} from '../../services/vehicleService';
import {withAlpha} from '../../theme/color';
import {softShadow} from '../../theme/shadow';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DashedOutline} from './DashedOutline';
import {VehicleIcon} from './VehicleIcon';

const TILE = 64;
const RADIUS = 18;
const GAP = 14;
/** Room around the tiles so their shadows are not clipped by the scroll view. */
const SHADOW_ROOM = 16;

interface VehicleStripProps {
  vehicles: Vehicle[];
  activeId: string | null;
  onPick: (id: string) => void;
  onAdd: () => void;
}

/** One rounded tile per vehicle (the active one ringed in accent), then a dashed "+" tile. */
export function VehicleStrip({vehicles, activeId, onPick, onAdd}: VehicleStripProps) {
  const c = useAppTheme().colors;
  const scroll = useRef<ScrollView>(null);
  const activeIndex = vehicles.findIndex((v) => v.id === activeId);
  return (
    // Bleeds to the screen edges so tiles scroll out of view instead of being cut at the margin.
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{marginHorizontal: -16, marginVertical: -SHADOW_ROOM + 6}}
      contentContainerStyle={{paddingHorizontal: 16, paddingVertical: SHADOW_ROOM, gap: GAP}}
      // Brings the active vehicle into view when it sits past the screen edge.
      onContentSizeChange={() => {
        if (activeIndex > 0) {
          scroll.current?.scrollTo({x: Math.max(0, activeIndex * (TILE + GAP) - TILE), animated: false});
        }
      }}>
      {vehicles.map((v) => {
        const on = v.id === activeId;
        return (
          <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={v.display_name} accessibilityState={{selected: on}} onPress={() => onPick(v.id)}>
            <View
              style={{
                width: TILE,
                height: TILE,
                borderRadius: RADIUS,
                borderWidth: 2.5,
                borderColor: on ? c.accent : 'transparent',
                // Rovy: every tile sits on the soft accent; the picked one is ringed in orange.
                backgroundColor: c.accentTint,
                alignItems: 'center',
                justifyContent: 'center',
                ...(on ? null : softShadow(c, 'small')),
              }}>
              <VehicleIcon type={v.vehicle_type} size={34} color={c.accent} />
            </View>
            {on ? (
              <View style={{position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, borderWidth: 2, borderColor: c.canvas, alignItems: 'center', justifyContent: 'center'}}>
                <Ionicons name="checkmark" size={11} color={c.onAccent} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Add vehicle" onPress={onAdd}>
        {({pressed}) => (
          <View
            style={{
              width: TILE,
              height: TILE,
              borderRadius: RADIUS,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            }}>
            <DashedOutline radius={RADIUS} color={withAlpha(c.accent, 0.55)} dash={[7, 6]} />
            <Ionicons name="add" size={30} color={c.accent} />
          </View>
        )}
      </Pressable>
    </ScrollView>
  );
}
