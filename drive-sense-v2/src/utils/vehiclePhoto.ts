import {ImageManipulator, SaveFormat} from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

/** Longest edge of the stored photo; plenty for a full-width card on a 3x screen. */
const MAX_EDGE = 1200;

/**
 * Lets the user take or choose a photo, crops it (4:3 for the Garage card, 1:1 for a profile photo),
 * shrinks it and returns base64 JPEG. Null when they cancel; throws a readable message when
 * permission is refused.
 */
export async function pickVehiclePhoto(source: PhotoSource, aspect: [number, number] = [4, 3]): Promise<string | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera' ? 'Allow camera access in Settings to take a photo.' : 'Allow photo access in Settings to choose a photo.');
  }
  const options: ImagePicker.ImagePickerOptions = {mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1};
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) {
    return null;
  }
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? {width: MAX_EDGE} : {height: MAX_EDGE});
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({format: SaveFormat.JPEG, compress: 0.75, base64: true});
  return saved.base64 ?? null;
}
