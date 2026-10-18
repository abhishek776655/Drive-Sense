import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {tripWeather, type TripWeather} from '../../services/tripWeather';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {skyGradient} from '../../utils/weatherSky';
import {AppText} from '../AppText';

const TONE_LABEL = {good: 'Good', care: 'Care', poor: 'Poor'} as const;

const iconFor = (w: TripWeather) =>
  w.code === 0 ? (w.isDay ? 'sunny' : 'moon') : w.code <= 3 ? 'partly-sunny' : w.code >= 95 ? 'thunderstorm' : w.code >= 51 ? 'rainy' : 'cloudy';

/**
 * The weather when the drive started, as a sky-coloured pill: icon and temperature, the condition
 * with wind and humidity, and how good it was for driving. Nothing shows until (unless) it loads.
 */
export function TripWeatherCard({tripId, latitude, longitude, startTime}: {tripId: string; latitude: number; longitude: number; startTime: string}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const {temperature} = useUnits();
  const [weather, setWeather] = useState<TripWeather | null>(null);

  useEffect(() => {
    let cancelled = false;
    tripWeather(tripId, latitude, longitude, startTime)
      .then((w) => !cancelled && setWeather(w))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tripId, latitude, longitude, startTime]);

  if (!weather) {
    return null;
  }
  const sky = skyGradient(weather.code, weather.isDay);
  const toneColor = {good: c.green, care: c.amber, poor: c.red}[weather.tone];
  return (
    <View style={{borderRadius: 34, overflow: 'hidden', backgroundColor: sky[0]}}>
      <LinearGradient colors={sky} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFill} />
      <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingLeft: 20, paddingRight: 14, gap: 14}}>
        <Ionicons name={iconFor(weather)} size={30} color={c.weatherIcon} />
        <AppText size={34} weight="black" color={c.onAccent}>
          {temperature(weather.temperatureC)}
        </AppText>
        <View style={{width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: withAlpha(c.onAccent, 0.3)}} />
        <View style={{flex: 1, gap: 4}}>
          <AppText size={14} weight="extrabold" color={c.onAccent} numberOfLines={1}>
            {weather.condition}
          </AppText>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
            {weather.windKmh != null ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                <Ionicons name="flag" size={12} color={withAlpha(c.onAccent, 0.8)} />
                <AppText size={12} weight="bold" color={withAlpha(c.onAccent, 0.85)}>
                  {weather.windKmh} km/h
                </AppText>
              </View>
            ) : null}
            {weather.humidity != null ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                <Ionicons name="water" size={12} color={withAlpha(c.onAccent, 0.8)} />
                <AppText size={12} weight="bold" color={withAlpha(c.onAccent, 0.85)}>
                  {Math.round(weather.humidity)}%
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <View accessibilityLabel={`Driving conditions: ${TONE_LABEL[weather.tone]}`} style={{width: 54, height: 54, borderRadius: 27, backgroundColor: toneColor, alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name={weather.tone === 'good' ? 'checkmark' : 'warning'} size={18} color={c.onAccent} />
          <AppText size={10} weight="black" color={c.onAccent}>
            {TONE_LABEL[weather.tone].toUpperCase()}
          </AppText>
        </View>
      </View>
    </View>
  );
}
