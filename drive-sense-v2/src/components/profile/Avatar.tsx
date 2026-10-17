import {View} from 'react-native';
import type {Profile} from '../../services/profileService';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {AuthedImage} from '../AuthedImage';

/** Profile photo in a soft accent ring (Rovy), or the handle's / email's initial without one. */
export function Avatar({profile, size}: {profile: Profile | null; size: number}) {
  const c = useAppTheme().colors;
  const ring = Math.max(2, Math.round(size / 28));
  const inner = size - ring * 2 - 4;
  const initial = (profile?.handle ?? profile?.email ?? '?').charAt(0).toUpperCase();
  return (
    <View style={{width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: withAlpha(c.accent, 0.35), alignItems: 'center', justifyContent: 'center'}}>
      {profile?.avatar_url ? (
        <AuthedImage path={profile.avatar_url} style={{width: inner, height: inner, borderRadius: inner / 2}} />
      ) : (
        <View style={{width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center'}}>
          <AppText size={Math.round(inner * 0.42)} weight="black" tone="accent">
            {initial}
          </AppText>
        </View>
      )}
    </View>
  );
}
