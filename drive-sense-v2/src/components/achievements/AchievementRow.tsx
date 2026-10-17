import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {Achievement} from '../../services/achievementsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {achievementDescription, progressLabel} from '../../utils/achievements';
import {AppText} from '../AppText';
import {AchievementIcon} from './AchievementIcon';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});

/** Rovy's achievement row; a locked one is faded and also says how far along it is. */
export function AchievementRow({achievement: a}: {achievement: Achievement}) {
  const c = useAppTheme().colors;
  const {units} = useUnits();
  const locked = !a.unlocked_at;
  const fraction = Math.min(1, a.progress / a.target);
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12}}>
      <AchievementIcon category={a.category} locked={locked} size={44} />
      <View style={{flex: 1, gap: 2}}>
        <AppText size={14} weight="extrabold" color={locked ? c.textTertiary : c.textPrimary}>
          {a.title}
        </AppText>
        <AppText size={12} weight="semibold" tone={locked ? 'tertiary' : 'secondary'}>
          {achievementDescription(a, units)}
        </AppText>
        {locked && fraction > 0 ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
            <View style={{flex: 1, height: 8, borderRadius: 4, backgroundColor: c.separator, overflow: 'hidden'}}>
              <View style={{width: `${fraction * 100}%`, height: '100%', borderRadius: 4, backgroundColor: c.textTertiary}} />
            </View>
            <AppText size={10} weight="bold" tone="tertiary">
              {progressLabel(a, units)}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{alignItems: 'flex-end', gap: 2}}>
        <AppText size={13} weight="black" color={locked ? c.textTertiary : c.green}>
          ★ +{a.xp}
        </AppText>
        {a.unlocked_at ? (
          <AppText size={10} weight="semibold" tone="tertiary">
            {shortDate(a.unlocked_at)}
          </AppText>
        ) : null}
      </View>
      {locked ? null : <Ionicons name="checkmark-circle" size={22} color={c.green} />}
    </View>
  );
}
