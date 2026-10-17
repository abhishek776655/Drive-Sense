import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet, View} from 'react-native';
import {useUnits} from '../hooks/useUnits';
import type {Weather} from '../services/weatherService';
import {useAppTheme} from '../theme/ThemeProvider';
import {skyGradient} from '../utils/weatherSky';
import {weatherFacts, drivingTipText} from '../utils/weatherAdvice';
import {AppText} from './AppText';
import {Glass} from './Glass';

/** Coloured like the sky outside (light blue on a clear day, dark blue in rain, navy at night). */
export function WeatherCard({weather}: {weather: Weather}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const {temperature, units} = useUnits();
  const facts = weatherFacts(weather, units);
  const sky = skyGradient(weather.code, weather.isDay);
  const toneColor = {good: c.green, care: c.amber, poor: c.red}[weather.tag.tone];
  const icon = weather.code === 0 ? (weather.isDay ? 'sunny' : 'moon') : weather.code <= 3 ? 'partly-sunny' : weather.code >= 95 ? 'thunderstorm' : weather.code >= 51 ? 'rainy' : 'cloudy';
  return (
    <View style={{borderRadius: theme.radius.hero, overflow: 'hidden', padding: 18, minHeight: 190, backgroundColor: sky[0]}}>
      <LinearGradient colors={sky} style={StyleSheet.absoluteFill} />
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5}}>
          <Ionicons name="location" size={13} color={c.onAccent} />
          <AppText size={12} weight="black" tone="onAccent" style={{letterSpacing: 1}}>
            {(weather.city ?? 'DRIVE WEATHER').toUpperCase()}
          </AppText>
        </View>
        <Ionicons name={icon} size={58} color={c.weatherIcon} />
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6}}>
        <View>
          <AppText size={58} weight="black" tone="onAccent" style={{lineHeight: 64}}>
            {temperature(weather.temperatureC)}
          </AppText>
          <AppText size={18} weight="extrabold" tone="onAccent">
            {weather.condition}
          </AppText>
          <AppText size={12} weight="semibold" tone="onAccent" style={{opacity: 0.7, marginTop: 2}}>
            H {temperature(weather.highC)} · L {temperature(weather.lowC)}
          </AppText>
        </View>
        {/* Liquid Glass over the sky: what to watch for on the road, and the numbers behind it. */}
        <Glass scheme="dark" shadow={false} radius={18} style={{maxWidth: 176, paddingHorizontal: 12, paddingVertical: 9, gap: 6}}>
          <View style={{flexDirection: 'row', gap: 7, alignItems: 'flex-start'}}>
            <View style={{width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: toneColor}} />
            <AppText size={12} weight="extrabold" tone="onAccent" style={{flexShrink: 1}}>
              {drivingTipText(weather, units)}
            </AppText>
          </View>
          {facts.length > 0 ? (
            <View style={{flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginLeft: 15}}>
              {facts.map((fact) => (
                <View key={fact.icon} style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
                  <Ionicons name={fact.icon} size={10} color={c.onAccent} style={{opacity: 0.75}} />
                  <AppText size={10} weight="bold" tone="onAccent" style={{opacity: 0.85}}>
                    {fact.text}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </Glass>
      </View>
    </View>
  );
}
