import {router} from 'expo-router';
import {View} from 'react-native';
import {RollingText} from './RollingText';
import {IconButton} from './IconButton';

/**
 * Two-line title ("My / Stats") that rolls in on every visit, with the gear that opens Settings,
 * or a back button on a pushed screen (`onBack`).
 */
export function ScreenHeader({kicker, title, onBack, backIcon = 'chevron-back'}: {kicker: string; title: string; onBack?: () => void; backIcon?: 'chevron-back' | 'close'}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20}}>
      <View>
        <RollingText size={32} lineHeight={38} weight="black" tone="secondary">
          {kicker}
        </RollingText>
        <RollingText size={42} lineHeight={48} weight="black" delayMs={80} style={{letterSpacing: -0.5}}>
          {title}
        </RollingText>
      </View>
      <View style={{marginBottom: 8}}>
        {onBack ? (
          <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} />
        ) : (
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        )}
      </View>
    </View>
  );
}
