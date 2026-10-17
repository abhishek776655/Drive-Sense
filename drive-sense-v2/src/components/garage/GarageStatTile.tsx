import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

type IconName = keyof typeof Ionicons.glyphMap;

/** Big value over a small label, a faint glyph in the corner (Rovy Garage stat tile). */
export function GarageStatTile({value, label, icon}: {value: string; label: string; icon: IconName}) {
  const c = useAppTheme().colors;
  return (
    <Card style={{flex: 1, height: 100, borderRadius: 28, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 12, justifyContent: 'flex-end'}}>
      <View style={{position: 'absolute', top: 14, right: 14}}>
        <Ionicons name={icon} size={14} color={c.textTertiary} />
      </View>
      <AppText size={34} weight="black" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{lineHeight: 40}}>
        {value}
      </AppText>
      <AppText size={13} weight="bold" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  );
}
