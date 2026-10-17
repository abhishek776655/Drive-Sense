import {AuthedImage} from '../AuthedImage';

/** The vehicle's stored photo, full width. */
export function VehiclePhoto({path, height, radius}: {path: string; height: number; radius: number}) {
  return <AuthedImage path={path} style={{width: '100%', height, borderRadius: radius}} />;
}
