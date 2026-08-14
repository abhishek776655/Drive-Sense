import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, View, Text, Image, Modal, Pressable, ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {vehicleImageSource} from '../utils/vehicleImage';
import {useAppTheme} from '../theme/appTheme';

interface Vehicle {
  id: string;
  name: string;
  type: string;
  imageUrl?: string | null;
}

const OPEN_DURATION_MS = 240;
const CLOSE_DURATION_MS = 180;
/** Used until the sheet has been measured, so the first open still travels off-screen. */
const FALLBACK_SHEET_HEIGHT = 460;

interface VehicleSelectorProps {
  visible: boolean;
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (vehicleId: string) => void;
  onClose: () => void;
  onAddVehicle?: () => void;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  visible,
  vehicles,
  selectedId,
  onSelect,
  onClose,
  onAddVehicle,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // The modal stays mounted a beat past `visible === false` so the sheet can slide back down
  // instead of vanishing.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(FALLBACK_SHEET_HEIGHT);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? OPEN_DURATION_MS : CLOSE_DURATION_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      // Both animated props (translateY, opacity) are native-driver safe.
      useNativeDriver: true,
    });

    animation.start(({finished}) => {
      // Only unmount on a close that ran to completion — a reopen mid-close would otherwise
      // tear down the modal it just reopened.
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [progress, visible]);

  const palette = {
    overlay: 'rgba(0,0,0,0.45)',
    sheet: theme.card,
    text: theme.text,
    textSecondary: theme.textSubtle,
    card: theme.cardSoft,
    selected: theme.accentMuted,
    selectedBorder: 'rgba(36,107,255,0.35)',
    accent: theme.accent,
    accentSoft: theme.accentMuted,
    border: theme.cardBorder,
  };

  return (
    // A Modal, not an absolutely-positioned overlay: the sheet is a child of the screen, so in-tree
    // it renders *under* the floating tab bar. The modal host sits above the whole navigator.
    // `animationType="none"`: the scrim fades while the sheet slides, which the built-in
    // transitions cannot do — "slide" drags the dimming layer up with the sheet.
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{flex: 1, opacity: progress}}>
        <Pressable
          style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.overlay}}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss vehicle picker"
        />
        <Animated.View
          className="absolute inset-x-0 bottom-0"
          style={{
            transform: [
              {
                translateY: progress.interpolate({inputRange: [0, 1], outputRange: [sheetHeight, 0]}),
              },
            ],
          }}>
          <View
            className="rounded-t-[28px] p-5"
            onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
            style={{
              backgroundColor: palette.sheet,
              // Clears the home indicator; the tab bar is no longer in play above this.
              paddingBottom: 20 + insets.bottom,
            }}>
            <View className="mb-[18px] flex-row items-center justify-between">
              <Text style={{color: palette.text, ...theme.typography.sectionTitle, fontSize: 18}}>Select Vehicle</Text>
              <Pressable onPress={onClose} className="p-2">
                <Ionicons name="close" size={20} color={palette.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{maxHeight: 360}} showsVerticalScrollIndicator={false}>
              {vehicles.map((vehicle) => (
                <Pressable
                  key={vehicle.id}
                  className="mb-2.5 flex-row items-center rounded-[18px] border p-[14px]"
                  style={{
                    backgroundColor: selectedId === vehicle.id ? palette.selected : palette.card,
                    borderColor: selectedId === vehicle.id ? palette.selectedBorder : palette.border,
                  }}
                  onPress={() => {
                    onSelect(vehicle.id);
                    onClose();
                  }}>
                  <Image
                    source={vehicleImageSource(vehicle.imageUrl)}
                    className="mr-3 h-11 w-14 rounded-[14px]"
                    style={{backgroundColor: palette.card}}
                    resizeMode="contain"
                  />
                  <View className="flex-1">
                    <Text style={{color: palette.text, ...theme.typography.body}}>{vehicle.name}</Text>
                    <Text className="mt-0.5" style={{color: palette.textSecondary, ...theme.typography.caption}}>{vehicle.type}</Text>
                  </View>
                  {selectedId === vehicle.id && (
                    <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => {
                onClose();
                onAddVehicle?.();
              }}
              className="mt-1 flex-row items-center justify-center rounded-[18px] border border-dashed p-[14px]"
              style={{
                borderColor: palette.border,
              }}>
              <Ionicons name="add-circle-outline" size={20} color={palette.accent} />
              <Text className="ml-2" style={{color: palette.accent, ...theme.typography.body}}>Add New Vehicle</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
