import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import type {StatsOverview} from '../../services/statsService';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration, formatInt} from '../../utils/format';
import {AppText} from '../AppText';

/** Orange lead card (as Home's Top speed and the Garage): the period's distance, drives and time. */
export function StatsHeroCard({summary, title}: {summary: StatsOverview['summary']; title: string}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const u = useUnits();
  const extras = [
    {label: 'Drives', value: formatInt(summary.trip_count)},
    {label: 'Drive time', value: formatDuration(summary.duration_seconds)},
  ];
  return (
    <View
      style={{
        backgroundColor: c.accent,
        borderRadius: 34,
        padding: 22,
        overflow: 'hidden',
        shadowColor: c.accent,
        shadowOpacity: theme.scheme === 'light' ? 0.3 : 0.2,
        shadowRadius: 14,
        shadowOffset: {width: 0, height: 6},
      }}>
      {/* A big faint glyph for texture, as Rovy's hero cards have. */}
      <Ionicons name="map" size={150} color={c.onAccent} style={{position: 'absolute', right: -24, bottom: -34, opacity: 0.1}} />
      <AppText size={12} weight="extrabold" tone="onAccent" style={{opacity: 0.7, letterSpacing: 0.8}}>
        {title.toUpperCase()}
      </AppText>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2}}>
        <AppText size={56} weight="black" tone="onAccent" style={{lineHeight: 64, flexShrink: 1}} numberOfLines={1}>
          {u.distance(summary.distance_meters)}
        </AppText>
        <AppText size={17} weight="extrabold" tone="onAccent" style={{opacity: 0.75, marginBottom: 11}}>
          {u.distanceUnit}
        </AppText>
      </View>
      <View style={{flexDirection: 'row', gap: 26, marginTop: 6}}>
        {extras.map((extra) => (
          <View key={extra.label}>
            <AppText size={20} weight="black" tone="onAccent">
              {extra.value}
            </AppText>
            <AppText size={12} weight="bold" tone="onAccent" style={{opacity: 0.7}}>
              {extra.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
