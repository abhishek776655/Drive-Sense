import {StyleSheet, Text, View} from 'react-native';
import {FONT} from '../../theme/theme';
import {CLUSTER_INK} from '../accents';

/** Web has no native map here; the Map page says so (the cluster is a phone feature). */
export function MapPage(_props: {accent: string}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.text}>Map is available on the phone</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  text: {color: CLUSTER_INK.textDim, fontFamily: FONT.bold, fontSize: 14},
});
