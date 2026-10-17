import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {TripInsight} from '../../services/tripService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {Card} from '../Card';

/** The server's notes on the drive ("You braked hard twice…"), at most three. */
export function InsightsList({insights}: {insights: TripInsight[]}) {
  const c = useAppTheme().colors;
  if (insights.length === 0) {
    return null;
  }
  const look = (tone: string): {icon: keyof typeof Ionicons.glyphMap; color: string} =>
    tone === 'warning' ? {icon: 'alert-circle', color: c.amber} : tone === 'success' ? {icon: 'checkmark-circle', color: c.green} : {icon: 'information-circle', color: c.blue};
  return (
    <Card style={{padding: 16, gap: 14}}>
      {insights.slice(0, 3).map((insight) => {
        const {icon, color} = look(insight.tone);
        return (
          <View key={insight.rule_id} style={{flexDirection: 'row', gap: 10}}>
            <Ionicons name={icon} size={20} color={color} />
            <View style={{flex: 1, gap: 2}}>
              <AppText size={14} weight="extrabold">
                {insight.title}
              </AppText>
              <AppText size={13} weight="semibold" tone="secondary">
                {insight.message}
              </AppText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}
