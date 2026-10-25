import {Tabs, usePathname} from 'expo-router';
import {GlassTabBar} from '../../components/GlassTabBar';
import {useObdLink} from '../../obd/useObdLink';
import {useRecordingStore} from '../../stores/recordingStore';
import {useLocationFeed} from '../../tracking/useLocationFeed';
import {useMotionFeed} from '../../tracking/useMotionFeed';
import {useBarometerFeed} from '../../tracking/useBarometerFeed';
import {useDeviceMotionFeed} from '../../tracking/useDeviceMotionFeed';
import {useBackgroundLocation} from '../../tracking/backgroundLocation';
import {useDriveHandoff} from '../../tracking/useDriveHandoff';
import {useSpeedAlertFeedback} from '../../tracking/useSpeedAlertFeedback';
import {useTripSync} from '../../tracking/useTripSync';

export default function TabsLayout() {
  const pathname = usePathname();
  const live = useRecordingStore((s) => s.status !== 'ready');
  const recording = useRecordingStore((s) => s.status === 'recording');
  // GPS runs while Drive is open or a drive is live, so other tabs never hold the radio idle.
  useLocationFeed(pathname === '/drive' || live);
  // The barometer follows GPS: it refines the same altitude.
  useBarometerFeed(pathname === '/drive' || live);
  useMotionFeed(recording);
  // Corners and road roughness for the drive's sensor summary.
  useDeviceMotionFeed(recording);
  useBackgroundLocation();
  useTripSync();
  useDriveHandoff();
  useSpeedAlertFeedback();
  useObdLink();

  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{headerShown: false}}>
      <Tabs.Screen name="index" options={{title: 'Home'}} />
      <Tabs.Screen name="logbook" options={{title: 'Logbook'}} />
      <Tabs.Screen name="drive" options={{title: 'Drive'}} />
      <Tabs.Screen name="telemetry" options={{title: 'Telemetry'}} />
      <Tabs.Screen name="garage" options={{title: 'Garage'}} />
    </Tabs>
  );
}
