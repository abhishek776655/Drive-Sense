import {Ionicons} from '@expo/vector-icons';
import {Redirect, router} from 'expo-router';
import {useEffect, useState} from 'react';
import {Alert, Animated, Platform, Pressable, ScrollView, Share, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../components/AppText';
import {Card} from '../components/Card';
import {RouteMap} from '../components/summary/RouteMap';
import {ScoreEventsCard} from '../components/summary/ScoreEventsCard';
import {Split} from '../components/summary/Split';
import {useUnits} from '../hooks/useUnits';
import {mappableEvents} from '../utils/tripEvents';
import {useFinishedDriveStore} from '../stores/finishedDriveStore';
import {useRecordingStore} from '../stores/recordingStore';
import {withAlpha} from '../theme/color';
import {softShadow} from '../theme/shadow';
import {useAppTheme} from '../theme/ThemeProvider';
import {formatDriveTime} from '../utils/summaryFormat';
import {ActionButton} from '../components/ActionButton';
import {MapButton} from '../components/trip/MapButton';
import {UnlockedCard} from '../components/achievements/UnlockedCard';

/** Ask before throwing a drive away. RN's Alert is a no-op on web, so web uses the browser dialog. */
const confirmDiscard = (onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.('Discard this drive? It will not be saved.')) {
      onConfirm();
    }
    return;
  }
  Alert.alert('Discard this drive?', 'It will not be saved.', [
    {text: 'Keep', style: 'cancel'},
    {text: 'Discard', style: 'destructive', onPress: onConfirm},
  ]);
};

/**
 * Shown after End: the drive's route and numbers, with Save (uploads it) and Discard (drops it;
 * nothing was sent yet). Full screen, no tab bar.
 */
export default function TripSummaryScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const u = useUnits();
  const {drive, saveStatus, error, save, discard, close: forget, detail, detailDone, progress} = useFinishedDriveStore();
  const lastFix = useRecordingStore((s) => s.position);
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(appear, {toValue: 1, useNativeDriver: true, damping: 16, stiffness: 140}).start();
  }, [appear]);

  if (!drive) {
    return <Redirect href="/drive" />;
  }

  // The drive is finished on the server as soon as it ends; Save closes once that is done (and
  // retries it if it failed). Discard deletes the trip.
  const saving = saveStatus === 'saving';
  const busy = saving || saveStatus === 'discarding';
  const local = saveStatus === 'local';
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/drive'));
  const onSave = async () => {
    if (await save()) {
      forget();
      leave();
    }
  };
  // After a failed save: the drive stays in the outbox and uploads when it can.
  const onGoBack = () => {
    forget();
    leave();
  };
  const onDiscard = () =>
    confirmDiscard(async () => {
      if (await discard()) {
        leave();
      }
    });
  // The server's value once stored (it may be a GPS estimate, shown with ≈); the phone's sensor
  // maximum until then.
  const maxG = (() => {
    if (detail?.max_g_force != null) {
      return {value: `${detail.max_g_source === 'sensor' ? '' : '≈'}${detail.max_g_force.toFixed(2)}`};
    }
    return {value: drive.maxG != null ? drive.maxG.toFixed(2) : '–'};
  })();
  const onShare = () =>
    Share.share({
      message: `Drove ${u.distance(drive.distanceM)} ${u.distanceUnit} in ${formatDriveTime(drive.durationSeconds)}, top speed ${u.speed(drive.topSpeedMps)} ${u.speedUnit}. Recorded with DriveSense.`,
    });

  const rise = (offset: number) => ({
    opacity: appear,
    transform: [{translateY: appear.interpolate({inputRange: [0, 1], outputRange: [offset, 0]})}],
  });
  // A drive with no movement has no route: centre the map on where the car is, not the whole country.
  const anchor = drive.route[0] ?? lastFix;
  const fallback = anchor ? {latitude: anchor.latitude, longitude: anchor.longitude} : null;

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: theme.space.screen, paddingBottom: 140 + insets.bottom}}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard drive"
          disabled={busy}
          onPress={onDiscard}
          style={{alignSelf: 'flex-start', backgroundColor: c.control, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10}}>
          <AppText size={17} weight="bold" color={c.red}>
            Discard
          </AppText>
        </Pressable>

        <Animated.View style={[{alignItems: 'center', marginTop: 22, marginBottom: 24}, rise(18)]}>
          <AppText size={38} weight="black">
            Great Drive!
          </AppText>
          <AppText size={17} weight="semibold" tone="secondary" style={{marginTop: 2}}>
            {drive.vehicle ? `With ${drive.vehicle.name}` : 'No vehicle selected'}
          </AppText>
        </Animated.View>

        <Animated.View style={[{gap: 14}, rise(36)]}>
          <Card style={{overflow: 'hidden'}}>
            <View style={{height: 220}}>
              <RouteMap route={drive.route} fallback={fallback} events={detail ? mappableEvents(detail.events) : []} />
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14}}>
              <Ionicons name="map" size={18} color={c.accent} />
              <AppText size={16} weight="extrabold" style={{flex: 1}}>
                Your Route
              </AppText>
              <AppText size={15} weight="bold" tone="secondary">
                {(u.distanceValue(drive.distanceM) ?? 0).toFixed(2)} {u.distanceUnit}
              </AppText>
            </View>
          </Card>

          <View style={{backgroundColor: c.accentTint, borderRadius: theme.radius.hero, paddingVertical: 22, ...softShadow(c)}}>
            <Split dividerColor={withAlpha(c.accent, 0.22)}>
              <>
                <AppText size={46} weight="black" style={{lineHeight: 52}}>
                  {u.speed(drive.topSpeedMps)}
                </AppText>
                <AppText size={15} weight="extrabold" tone="accent">
                  {u.speedUnit} Top Speed
                </AppText>
              </>
              <>
                <AppText size={46} weight="black" style={{lineHeight: 52}}>
                  {formatDriveTime(drive.durationSeconds)}
                </AppText>
                <AppText size={15} weight="extrabold" tone="accent">
                  Drive Time
                </AppText>
              </>
            </Split>
          </View>

          <ScoreEventsCard detail={detail} pending={saving || (saveStatus === 'saved' && !detailDone)} phoneEventCount={drive.eventCount} />

          <Card style={{paddingVertical: 18}}>
            <Split>
              <>
                <AppText size={28} weight="black">
                  {u.distance(drive.distanceM)}
                  <AppText size={13} weight="bold" color={c.blue}>
                    {' '}
                    {u.distanceUnit}
                  </AppText>
                </AppText>
                <AppText size={13} weight="bold" tone="secondary">
                  Distance
                </AppText>
              </>
              <>
                <AppText size={28} weight="black">
                  {u.speed(drive.avgSpeedMps)}
                  <AppText size={13} weight="bold" color={c.cyan}>
                    {' '}
                    {u.speedUnit}
                  </AppText>
                </AppText>
                <AppText size={13} weight="bold" tone="secondary">
                  Avg Speed
                </AppText>
              </>
              <>
                <AppText size={28} weight="black">
                  {maxG.value}
                  <AppText size={13} weight="bold" color={c.purple}>
                    {' '}
                    G
                  </AppText>
                </AppText>
                <AppText size={13} weight="bold" tone="secondary">
                  Max G-Force
                </AppText>
              </>
            </Split>
          </Card>

          <UnlockedCard tripId={progress.tripId} ready={saveStatus === 'saved' && detailDone} />

          {local ? (
            <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12}}>
              <AppText size={13} weight="bold" tone="accent">
                No vehicle was chosen, so this drive cannot be saved. Pick a vehicle on Drive before your next drive.
              </AppText>
            </View>
          ) : null}
          {saveStatus === 'queued' ? (
            <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center'}}>
              <Ionicons name="cloud-upload-outline" size={20} color={c.accent} />
              <AppText size={13} weight="bold" tone="accent" style={{flex: 1}}>
                Saved on this phone. It uploads by itself when you are back online.
              </AppText>
            </View>
          ) : null}
          {error ? (
            <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12}}>
              <AppText size={13} weight="bold" tone="accent">
                {error}
              </AppText>
              {/* The drive is already kept on the phone (it retries from the outbox), so leaving loses nothing. */}
              {saveStatus === 'error' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back, keep the drive on this phone"
                  onPress={onGoBack}
                  style={{alignSelf: 'flex-start', marginTop: 10, backgroundColor: c.control, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8}}>
                  <AppText size={13} weight="extrabold">
                    Go back, save later
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{position: 'absolute', left: theme.space.screen, right: theme.space.screen, bottom: insets.bottom + 12, flexDirection: 'row', gap: 12}}>
        <MapButton icon="share-outline" label="Share drive" onPress={onShare} size={60} color={c.accent} />
        {/* Save takes the rest of the row next to Share. */}
        <View style={{flex: 1}}>
          <ActionButton
            label={saveStatus === 'error' ? 'Retry Save' : 'Save'}
            accessibilityLabel={saveStatus === 'error' ? 'Retry saving drive' : 'Save drive'}
            onPress={onSave}
            busy={busy}
            disabled={local}
            height={60}
            size={19}
            style={{width: '100%'}}
          />
        </View>
      </View>
    </View>
  );
}
