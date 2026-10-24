import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import Constants from 'expo-constants';
import {LinearGradient} from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {router, useFocusEffect} from 'expo-router';
import {useCallback, useEffect, useState} from 'react';
import {Alert, Animated, AppState, Linking, Platform, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../../components/AppText';
import {Card} from '../../components/Card';
import {DeleteAccountSheet} from '../../components/settings/DeleteAccountSheet';
import {DriveBackupSection} from '../../components/settings/DriveBackupSection';
import {NumberSheet} from '../../components/settings/NumberSheet';
import {ReliabilityTile} from '../../components/settings/ReliabilityTile';
import {SelectMenu} from '../../components/settings/SelectMenu';
import {PillChoice, SettingsGroup, SettingsLabel, SettingsRow, SettingsSwitch} from '../../components/settings/SettingsRows';
import {requestNotificationPermission} from '../../notifications/driveNotifications';
import {CURRENCIES, priceInUnits, pricePerLitreFrom, priceUnit} from '../../obd/fuel';
import {MapButton} from '../../components/trip/MapButton';
import {PRIVACY_POLICY_URL, SUPPORT_EMAIL} from '../../config/links';
import {LevelCard} from '../../components/achievements/LevelCard';
import {Avatar} from '../../components/profile/Avatar';
import {accountService} from '../../services/accountService';
import {getApiErrorMessage} from '../../services/apiClient';
import {useAchievementsStore} from '../../stores/achievementsStore';
import {useAuthStore} from '../../stores/authStore';
import {useProfileStore} from '../../stores/profileStore';
import {
  AUTO_PAUSE_SECONDS,
  AUTO_STOP_MINUTES,
  MAX_FUEL_PRICE,
  SPEED_ALERT_MAX_KMH,
  SPEED_ALERT_MIN_KMH,
  SPEED_ALERT_STEP_KMH,
  usePreferencesStore,
  type MapStyle,
} from '../../stores/preferencesStore';
import {useActiveVehicle} from '../../stores/vehicleStore';
import {withAlpha} from '../../theme/color';
import {useAppearanceStore} from '../../theme/appearanceStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import type {AppearancePreference} from '../../theme/theme';
import {POWER_MODES} from '../../tracking/powerMode';
import {kmhInUnits, speedUnit} from '../../utils/units';

const HEADER_ROW = 58;
const HEADER_FADE = 18;
const BLUR_STEPS = 5;
/** Scroll past the large title and the small centred one takes over. */
const TITLE_SWAP = 44;

const MAP_STYLES: {value: MapStyle; label: string}[] = [
  {value: 'muted', label: 'Muted'},
  {value: 'standard', label: 'Standard'},
  {value: 'satellite', label: 'Satellite'},
  {value: 'hybrid', label: 'Hybrid'},
];
const APPEARANCES: {value: AppearancePreference; label: string}[] = [
  {value: 'system', label: 'System'},
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
];

type Permissions = {always: boolean; precise: boolean} | null;

const readPermissions = async (): Promise<Permissions> => {
  try {
    const [foreground, background] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
    const precise = Platform.OS === 'ios' ? foreground.ios?.accuracy !== 'reduced' : foreground.android?.accuracy !== 'coarse';
    return {always: background.status === 'granted', precise: foreground.granted && precise};
  } catch {
    return null;
  }
};

/**
 * Settings, as a sheet over the tabs (Rovy): profile, preferences, driving rules, power mode,
 * recording reliability, account and about. Everything but the account lives on this device.
 */
export default function SettingsScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [asSheet] = useState(() => Platform.OS === 'ios' && router.canGoBack());
  const sheetTop = asSheet ? 18 : insets.top + 8;
  const headerHeight = sheetTop + HEADER_ROW;
  const [scrollY] = useState(() => new Animated.Value(0));
  const blurOpacity = scrollY.interpolate({inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp'});
  const smallTitle = scrollY.interpolate({inputRange: [TITLE_SWAP - 12, TITLE_SWAP], outputRange: [0, 1], extrapolate: 'clamp'});

  const prefs = usePreferencesStore();
  const setPrefs = prefs.set;
  const {preference, setPreference} = useAppearanceStore();
  const logout = useAuthStore((s) => s.logout);
  const vehicle = useActiveVehicle();
  const profile = useProfileStore((s) => s.profile);
  const loadProfile = useProfileStore((s) => s.load);
  const achievements = useAchievementsStore((s) => s.data);
  const loadAchievements = useAchievementsStore((s) => s.load);
  const [permissions, setPermissions] = useState<Permissions>(null);
  const [sheet, setSheet] = useState<'delete' | 'fuelPrice' | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadProfile();
    void loadAchievements();
  }, [loadProfile, loadAchievements]);

  // Re-read permissions on open and whenever the app comes back from iOS Settings.
  useFocusEffect(
    useCallback(() => {
      void readPermissions().then(setPermissions);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void readPermissions().then(setPermissions);
        }
      });
      return () => subscription.remove();
    }, []),
  );

  const unit = speedUnit(prefs.units);
  const close = () => router.back();

  const onExport = async () => {
    setExporting(true);
    try {
      await accountService.exportDrives();
    } catch (error) {
      Alert.alert('Export failed', getApiErrorMessage(error, 'Could not export your drives.'));
    } finally {
      setExporting(false);
    }
  };

  const onSignOut = () =>
    Alert.alert('Sign out?', undefined, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          useProfileStore.getState().clear();
          void logout();
        },
      },
    ]);

  const deleteAccount = async (password: string) => {
    await accountService.deleteAccount(password);
    setSheet(null);
    useProfileStore.getState().clear();
    await logout();
  };

  const stepAlert = (by: number) =>
    void setPrefs({speedAlertKmh: Math.min(SPEED_ALERT_MAX_KMH, Math.max(SPEED_ALERT_MIN_KMH, prefs.speedAlertKmh + by * SPEED_ALERT_STEP_KMH))});

  // The app's own version (app.json); in Expo Go the native version would be Expo Go's.
  const version = Constants.expoConfig?.version ?? '–';

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
        scrollIndicatorInsets={{top: headerHeight}}
        contentContainerStyle={{paddingTop: headerHeight - 6, paddingHorizontal: theme.space.screen, paddingBottom: insets.bottom + 40}}>
        <AppText size={38} weight="black" style={{letterSpacing: -0.5, marginBottom: 16, marginLeft: 4}}>
          Settings
        </AppText>

        <Pressable accessibilityRole="button" accessibilityLabel="My profile" onPress={() => router.push('/settings/profile')}>
          {({pressed}) => (
            <Card style={{flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, opacity: pressed ? 0.7 : 1}}>
              <Avatar profile={profile} size={60} />
              <View style={{flex: 1}}>
                <AppText size={18} weight="black" numberOfLines={1} tone={profile && !profile.handle ? 'accent' : 'primary'}>
                  {profile?.handle ? `@${profile.handle}` : profile ? 'Set your handle' : 'Your account'}
                </AppText>
                <AppText size={13} weight="semibold" tone="secondary" numberOfLines={1}>
                  {vehicle ? vehicle.display_name : 'No vehicle yet'}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={c.textTertiary} />
            </Card>
          )}
        </Pressable>

        {achievements ? (
          <View style={{marginTop: 18}}>
            <LevelCard data={achievements} onPress={() => router.push('/settings/achievements')} />
          </View>
        ) : null}

        <SettingsLabel>PREFERENCES</SettingsLabel>
        <SettingsGroup>
          <SettingsRow
            icon="speedometer"
            iconColor={c.blue}
            title="Units"
            right={<PillChoice options={[{value: 'metric', label: 'km/h'}, {value: 'imperial', label: 'mph'}]} value={prefs.units} onChange={(units) => void setPrefs({units})} />}
          />
          <SettingsRow
            icon="thermometer"
            iconColor={c.accent}
            title="Temperature"
            right={<PillChoice options={[{value: 'c', label: '°C'}, {value: 'f', label: '°F'}]} value={prefs.temperature} onChange={(temperature) => void setPrefs({temperature})} />}
          />
          <SettingsRow
            icon="moon"
            iconColor={c.purple}
            title="Appearance"
            below={<PillChoice stretch options={APPEARANCES} value={preference} onChange={(p) => void setPreference(p)} />}
          />
          <SettingsRow
            icon="map"
            iconColor={c.amber}
            title="Map style"
            right={<SelectMenu accessibilityLabel="Map style" options={MAP_STYLES} value={prefs.mapStyle} onChange={(mapStyle) => void setPrefs({mapStyle})} />}
          />
        </SettingsGroup>

        <SettingsLabel>FUEL</SettingsLabel>
        <SettingsGroup>
          <SettingsRow
            icon="pricetag"
            iconColor={c.green}
            title="Fuel price"
            subtitle="Prices the fuel your car adapter measures. Changing it reprices past drives too."
            onPress={() => setSheet('fuelPrice')}
            right={
              <AppText size={15} weight="extrabold" tone={prefs.fuelPrice != null ? 'primary' : 'accent'}>
                {prefs.fuelPrice != null ? `${prefs.currency}${priceInUnits(prefs.fuelPrice, prefs.units).toFixed(2)} / ${priceUnit(prefs.units)}` : 'Set'}
              </AppText>
            }
          />
          {prefs.units === 'metric' ? (
            <SettingsRow
              icon="leaf"
              iconColor={c.green}
              title="Mileage"
              right={
                <PillChoice
                  options={[
                    {value: 'kmpl', label: 'km/L'},
                    {value: 'l100', label: 'L/100'},
                  ]}
                  value={prefs.mileageUnit}
                  onChange={(mileageUnit) => void setPrefs({mileageUnit})}
                />
              }
            />
          ) : null}
          <SettingsRow
            icon="cash"
            iconColor={c.teal}
            title="Currency"
            below={<PillChoice stretch options={CURRENCIES.map((value) => ({value, label: value}))} value={prefs.currency} onChange={(currency) => void setPrefs({currency})} />}
          />
        </SettingsGroup>

        <SettingsLabel>DRIVING</SettingsLabel>
        <SettingsGroup>
          <SettingsRow
            icon="play-circle"
            iconColor={c.green}
            title="Auto-start"
            subtitle="Start recording when you drive off"
            right={<SettingsSwitch label="Auto-start" value={prefs.autoStart} onChange={(autoStart) => void setPrefs({autoStart})} />}
          />
          <SettingsRow
            icon="hardware-chip"
            iconColor={c.accent}
            title="Start with car adapter"
            subtitle="Start recording when your paired OBD-II adapter connects"
            right={<SettingsSwitch label="Start with car adapter" value={prefs.obdAutoStart} onChange={(obdAutoStart) => void setPrefs({obdAutoStart})} />}
          />
          <SettingsRow
            icon="stop-circle"
            iconColor={c.red}
            title="Auto-stop"
            subtitle="End the drive once parked"
            right={<SettingsSwitch label="Auto-stop" value={prefs.autoStop} onChange={(autoStop) => void setPrefs({autoStop})} />}
            below={
              prefs.autoStop ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
                  <AppText size={14} weight="bold" tone="secondary">
                    Stop after
                  </AppText>
                  <SelectMenu
                    accent
                    accessibilityLabel="Stop after"
                    options={AUTO_STOP_MINUTES.map((m) => ({value: m, label: `${m} min`}))}
                    value={prefs.autoStopMinutes}
                    onChange={(autoStopMinutes) => void setPrefs({autoStopMinutes})}
                  />
                </View>
              ) : null
            }
          />
          <SettingsRow
            icon="pause-circle"
            iconColor={c.amber}
            title="Auto-pause"
            subtitle="Pause when the vehicle stands still, resume when you drive off"
            right={<SettingsSwitch label="Auto-pause" value={prefs.autoPause} onChange={(autoPause) => void setPrefs({autoPause})} />}
            below={
              prefs.autoPause ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
                  <AppText size={14} weight="bold" tone="secondary">
                    Pause after
                  </AppText>
                  <SelectMenu
                    accent
                    accessibilityLabel="Pause after"
                    options={AUTO_PAUSE_SECONDS.map((sec) => ({value: sec, label: sec < 60 ? `${sec} s` : `${sec / 60} min`}))}
                    value={prefs.autoPauseSeconds}
                    onChange={(autoPauseSeconds) => void setPrefs({autoPauseSeconds})}
                  />
                </View>
              ) : null
            }
          />
          <SettingsRow
            icon="trash-bin"
            iconColor={c.teal}
            title="Ignore short drives"
            subtitle="Under 300 m or 1 min are not saved"
            right={<SettingsSwitch label="Ignore short drives" value={prefs.ignoreShortDrives} onChange={(ignoreShortDrives) => void setPrefs({ignoreShortDrives})} />}
          />
          <SettingsRow
            icon="warning"
            iconColor={c.amber}
            title="Speed alert"
            subtitle="Vibrate when you go over the limit"
            right={<SettingsSwitch label="Speed alert" value={prefs.speedAlert} onChange={(speedAlert) => void setPrefs({speedAlert})} />}
            below={
              prefs.speedAlert ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                  <AppText size={13} weight="bold" tone="secondary" style={{flex: 1}}>
                    Limit
                  </AppText>
                  <MapButton icon="remove" label="Lower limit" onPress={() => stepAlert(-1)} size={34} color={c.accent} disabled={prefs.speedAlertKmh <= SPEED_ALERT_MIN_KMH} />
                  <AppText size={18} weight="black" style={{minWidth: 84, textAlign: 'center'}}>
                    {kmhInUnits(prefs.speedAlertKmh, prefs.units)}
                    <AppText size={12} weight="bold" tone="secondary">
                      {' '}
                      {unit}
                    </AppText>
                  </AppText>
                  <MapButton icon="add" label="Raise limit" onPress={() => stepAlert(1)} size={34} color={c.accent} disabled={prefs.speedAlertKmh >= SPEED_ALERT_MAX_KMH} />
                </View>
              ) : null
            }
          />
          <SettingsRow
            icon="notifications"
            iconColor={c.red}
            title="Notifications"
            subtitle="Drive summaries and a nudge when a drive is left running"
            right={
              <SettingsSwitch
                label="Notifications"
                value={prefs.notifications}
                onChange={(notifications) => {
                  void setPrefs({notifications});
                  if (notifications) {
                    void requestNotificationPermission();
                  }
                }}
              />
            }
          />
        </SettingsGroup>

        <SettingsLabel>POWER MODE</SettingsLabel>
        <Card style={{padding: 16, gap: 10}}>
          <PillChoice stretch options={(Object.keys(POWER_MODES) as (keyof typeof POWER_MODES)[]).map((m) => ({value: m, label: POWER_MODES[m].label}))} value={prefs.powerMode} onChange={(powerMode) => void setPrefs({powerMode})} />
          <AppText size={13} weight="semibold" tone="secondary">
            {POWER_MODES[prefs.powerMode].hint} Applies from your next drive.
          </AppText>
        </Card>

        <SettingsLabel>RECORDING RELIABILITY</SettingsLabel>
        <Card style={{padding: 12, gap: 10}}>
          <View style={{flexDirection: 'row', gap: 10}}>
            <ReliabilityTile icon="location" color={c.green} title="Always Allow" hint={'Location set to "Always"'} ok={permissions?.always} onFix={() => void Linking.openSettings()} />
            <ReliabilityTile icon="locate" color={c.blue} title="Precise Location" hint="Exact position for routes" ok={permissions?.precise} onFix={() => void Linking.openSettings()} />
          </View>
          <View style={{flexDirection: 'row', gap: 10}}>
            <ReliabilityTile icon="flash" color={c.amber} title="Low Power Off" hint="Turn it off for long drives" />
            <ReliabilityTile icon="phone-portrait" color={c.purple} title="Open the App" hint="Open it briefly during a drive" />
          </View>
        </Card>

        <DriveBackupSection />

        <SettingsLabel>ACCOUNT & DATA</SettingsLabel>
        <SettingsGroup>
          <SettingsRow icon="download" iconColor={c.blue} title={exporting ? 'Exporting…' : 'Export drives'} subtitle="Every drive as a CSV file" onPress={exporting ? undefined : () => void onExport()} />
          <SettingsRow icon="log-out" iconColor={c.textSecondary} title="Sign out" onPress={onSignOut} />
          <SettingsRow icon="trash" iconColor={c.red} title="Delete account" subtitle="Your account and all drives, for good" destructive onPress={() => setSheet('delete')} />
        </SettingsGroup>

        <SettingsLabel>ABOUT</SettingsLabel>
        <SettingsGroup>
          {SUPPORT_EMAIL ? <SettingsRow icon="mail" iconColor={c.accent} title="Contact support" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} /> : null}
          {PRIVACY_POLICY_URL ? <SettingsRow icon="shield-checkmark" iconColor={c.green} title="Privacy policy" onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} /> : null}
          <SettingsRow
            icon="information-circle"
            iconColor={c.textSecondary}
            title="Version"
            right={
              <AppText size={15} weight="bold" tone="secondary">
                {version}
              </AppText>
            }
          />
        </SettingsGroup>
        <AppText size={11} weight="semibold" tone="tertiary" style={{textAlign: 'center', marginTop: 24}}>
          Tab icons from Lucide (ISC)
        </AppText>
      </Animated.ScrollView>

      {/* Pinned header: the small title fades in once the large one scrolls away; ✕ stays put. */}
      <View pointerEvents="box-none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: headerHeight + HEADER_FADE}}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity: blurOpacity}]}>
          {Array.from({length: BLUR_STEPS}, (_, i) => (
            <BlurView
              key={i}
              intensity={8}
              tint={c.glassBlurTint}
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={{position: 'absolute', left: 0, right: 0, top: 0, height: (headerHeight + HEADER_FADE) * ((BLUR_STEPS - i) / BLUR_STEPS)}}
            />
          ))}
          <LinearGradient
            colors={[withAlpha(c.canvas, 0.92), withAlpha(c.canvas, 0.65), withAlpha(c.canvas, 0)]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={{flexDirection: 'row', alignItems: 'center', paddingTop: sheetTop, paddingHorizontal: theme.space.screen}}>
          <View style={{width: 44}} />
          <Animated.View pointerEvents="none" style={{flex: 1, alignItems: 'center', opacity: smallTitle}}>
            <AppText size={18} weight="black">
              Settings
            </AppText>
          </Animated.View>
          <MapButton icon="close" label="Close settings" onPress={close} size={44} color={c.textSecondary} />
        </View>
      </View>

      {sheet === 'delete' ? <DeleteAccountSheet visible onConfirm={deleteAccount} onClose={() => setSheet(null)} /> : null}
      {sheet === 'fuelPrice' ? (
        <NumberSheet
          title="Fuel price"
          hint={`What a ${prefs.units === 'imperial' ? 'gallon' : 'litre'} of fuel costs you.`}
          prefix={prefs.currency}
          unit={`/ ${priceUnit(prefs.units)}`}
          initial={prefs.fuelPrice != null ? priceInUnits(prefs.fuelPrice, prefs.units) : null}
          valid={(v) => v > 0 && pricePerLitreFrom(v, prefs.units) <= MAX_FUEL_PRICE}
          onSave={(v) => {
            void setPrefs({fuelPrice: v == null ? null : pricePerLitreFrom(v, prefs.units)});
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}
