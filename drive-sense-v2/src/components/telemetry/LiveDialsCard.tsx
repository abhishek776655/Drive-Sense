import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {CLUSTER_INK} from '../../cluster/accents';
import {dialMax, redlineHeat} from '../../cluster/motion';
import {ArcDial} from '../../cluster/parts/ArcDial';
import {useDriveSettingsStore} from '../../stores/driveSettingsStore';
import {FONT} from '../../theme/theme';

/**
 * The Telemetry hero: speed and RPM as two glowing cluster dials on a dark face, the same Skia
 * dials as cluster mode (start-up sweep, glow, afterglow, redline heat), sized to the card.
 */
export function LiveDialsCard({speed, speedUnit, imperial, rpm, gear, redline}: {speed: number | null; speedUnit: string; imperial: boolean; rpm: number | null; gear: string | null; redline: number}) {
  const {width} = useWindowDimensions();
  const accent = useDriveSettingsStore((s) => s.gaugeAccent);
  // Two dials across the card, with the screen's side gutters and the card's padding taken off.
  const dial = Math.min(190, (width - 32 - 24) / 2);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <ArcDial size={dial} value={speed} max={dialMax(imperial ? 140 : 220, 20, speed)} majorStep={20} minorStep={10} accent={accent} unit={speedUnit} numberScale={0.26} />
        <ArcDial
          size={dial}
          value={rpm}
          max={dialMax(8000, 1000, rpm)}
          majorStep={1000}
          minorStep={500}
          accent={accent}
          unit="rpm"
          redline={redline}
          redHeat={redlineHeat(rpm, redline)}
          settleMs={180}
          display={rpm == null ? '–' : Math.round(rpm).toLocaleString('en-US')}
          numberScale={0.17}
          footer={
            gear ? (
              <View style={[styles.gear, {borderColor: accent}]}>
                <Text style={[styles.gearText, {color: accent}]}>{gear}</Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: CLUSTER_INK.background,
    borderWidth: 1,
    borderColor: CLUSTER_INK.glassEdge,
    overflow: 'hidden',
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  gear: {marginTop: 6, minWidth: 28, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6},
  gearText: {fontFamily: FONT.black, fontSize: 14},
});
