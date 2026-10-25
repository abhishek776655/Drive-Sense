import {Ionicons} from '@expo/vector-icons';
import {View} from 'react-native';
import type {TripSensors} from '../../tracking/sensors/types';
import {useAppTheme} from '../../theme/ThemeProvider';
import {formatDuration} from '../../utils/format';
import {AppText} from '../AppText';
import {Card} from '../Card';
import {SectionTitle} from './SectionTitle';

/**
 * Trip Detail's road and phone story from this phone's sensors (spec 2026-10-25, telemetry sources,
 * section 3): how smooth the road was, as a bar, and time spent on the phone while moving.
 */
export function RoadSection({sensors}: {sensors: TripSensors | null}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const road = sensors?.road.summary ?? null;
  const phoneUseS = sensors?.phoneUseS ?? 0;
  if (!road && phoneUseS < 1) {
    return null;
  }
  const parts = road
    ? [
        {key: 'smooth', label: 'Smooth', share: road.smooth, color: c.green},
        {key: 'fair', label: 'Fair', share: road.fair, color: c.amber},
        {key: 'rough', label: 'Rough', share: road.rough, color: c.red},
      ]
    : [];
  return (
    <>
      <SectionTitle icon="trail-sign" color={c.amber} title="Road" />
      <Card style={{padding: 16, gap: 14}}>
        {road ? (
          <View style={{gap: 10}}>
            <View style={{flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.control}}>
              {parts.map((p) => (p.share > 0 ? <View key={p.key} style={{flex: p.share, backgroundColor: p.color}} /> : null))}
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              {parts.map((p) => (
                <View key={p.key} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: p.color}} />
                  <AppText size={13} weight="bold" tone="secondary">
                    {p.label} {Math.round(p.share * 100)}%
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {phoneUseS >= 1 ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <Ionicons name="phone-portrait" size={18} color={c.purple} />
            <AppText size={14} weight="bold" style={{flex: 1}}>
              Phone use while moving
            </AppText>
            <AppText size={15} weight="black">
              {/* Under a minute reads in seconds (formatDuration would say 0m). */}
              {phoneUseS < 60 ? `${Math.round(phoneUseS)}s` : formatDuration(phoneUseS)}
            </AppText>
          </View>
        ) : null}
      </Card>
    </>
  );
}
