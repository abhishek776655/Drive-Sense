import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {isoDay, monthRange, monthWeeks, parseDay, pickDay, rangeLabel, type DayRange} from '../../utils/calendar';
import {AppText} from '../AppText';
import {BottomSheet} from '../drive/BottomSheet';
import {SegmentedToggle} from '../trip/SegmentedToggle';
import {ActionButton} from '../ActionButton';

type Mode = 'month' | 'custom';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = Array.from({length: 12}, (_, m) => new Date(2000, m, 1).toLocaleDateString('en-IN', {month: 'short'}));
const DAY = 40;

interface DateRangeSheetProps {
  visible: boolean;
  /** The range in use, if the page is on a custom range already. */
  range: DayRange | null;
  onApply: (range: DayRange) => void;
  onClose: () => void;
}

function Stepper({label, onPrev, onNext, nextDisabled}: {label: string; onPrev: () => void; onNext: () => void; nextDisabled: boolean}) {
  const c = useAppTheme().colors;
  const arrow = (icon: 'chevron-back' | 'chevron-forward', onPress: () => void, disabled: boolean, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} hitSlop={8} style={{width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glassRow, opacity: disabled ? 0.35 : 1}}>
      <Ionicons name={icon} size={18} color={c.accent} />
    </Pressable>
  );
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
      {arrow('chevron-back', onPrev, false, 'Previous')}
      <AppText size={16} weight="black">
        {label}
      </AppText>
      {arrow('chevron-forward', onNext, nextDisabled, 'Next')}
    </View>
  );
}

/**
 * Pick a whole month (year stepper over a 12-month grid) or any span of days (a calendar: tap the
 * first day, then the last). Days after today cannot be picked. Parent mounts it only while open.
 */
export function DateRangeSheet({visible, range, onApply, onClose}: DateRangeSheetProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const today = new Date();
  const todayIso = isoDay(today);
  const shown = range ? parseDay(range.end) : today;
  const [mode, setMode] = useState<Mode>('month');
  const [year, setYear] = useState(shown.getFullYear());
  const [cursor, setCursor] = useState({year: shown.getFullYear(), month: shown.getMonth()});
  const [draft, setDraft] = useState<{start: string | null; end: string | null}>(range ?? {start: null, end: null});

  const apply = (picked: DayRange) => {
    onApply(picked);
    onClose();
  };
  const atThisMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const stepMonth = (by: number) => setCursor(({year: y, month: m}) => ({year: y + Math.floor((m + by) / 12), month: (((m + by) % 12) + 12) % 12}));
  const draftRange = draft.start ? {start: draft.start, end: draft.end ?? draft.start} : null;

  return (
    <BottomSheet visible={visible} title="Dates" onClose={onClose}>
      <View style={{gap: 16, marginTop: 8, marginBottom: 8}}>
        <View style={{alignItems: 'center'}}>
          <SegmentedToggle
            options={[
              {value: 'month', label: 'Month'},
              {value: 'custom', label: 'Custom'},
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>

        {mode === 'month' ? (
          <>
            <Stepper label={String(year)} onPrev={() => setYear((y) => y - 1)} onNext={() => setYear((y) => y + 1)} nextDisabled={year >= today.getFullYear()} />
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {MONTHS.map((name, m) => {
                const value = monthRange(year, m);
                const future = value.start > todayIso;
                const on = range?.start === value.start && range?.end === value.end;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`${name} ${year}`}
                    accessibilityState={{selected: on, disabled: future}}
                    disabled={future}
                    onPress={() => apply(value)}
                    style={{width: '31.5%', height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.glassRow, opacity: future ? 0.35 : 1}}>
                    <AppText size={15} weight="extrabold" color={on ? c.onAccent : c.textPrimary}>
                      {name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Stepper
              label={new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'})}
              onPrev={() => stepMonth(-1)}
              onNext={() => stepMonth(1)}
              nextDisabled={atThisMonth}
            />
            <View style={{gap: 4}}>
              <View style={{flexDirection: 'row'}}>
                {WEEKDAYS.map((d, i) => (
                  <AppText key={i} size={11} weight="extrabold" tone="tertiary" style={{flex: 1, textAlign: 'center'}}>
                    {d}
                  </AppText>
                ))}
              </View>
              {monthWeeks(cursor.year, cursor.month).map((week, w) => (
                <View key={w} style={{flexDirection: 'row'}}>
                  {week.map((day, i) => {
                    if (!day) {
                      return <View key={i} style={{flex: 1, height: DAY}} />;
                    }
                    const iso = isoDay(day);
                    const future = iso > todayIso;
                    const end = draft.end ?? draft.start;
                    const edge = iso === draft.start || iso === end;
                    const inside = draft.start != null && end != null && iso > draft.start && iso < end;
                    return (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        accessibilityLabel={day.toDateString()}
                        accessibilityState={{selected: edge || inside, disabled: future}}
                        disabled={future}
                        onPress={() => setDraft((d) => pickDay(d, iso))}
                        style={{flex: 1, height: DAY, alignItems: 'center', justifyContent: 'center', backgroundColor: inside ? c.accentTint : undefined, opacity: future ? 0.3 : 1}}>
                        <View style={{width: DAY - 4, height: DAY - 4, borderRadius: (DAY - 4) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? c.accent : undefined}}>
                          <AppText size={15} weight={edge ? 'black' : 'bold'} color={edge ? c.onAccent : iso === todayIso ? c.accent : c.textPrimary}>
                            {day.getDate()}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <AppText size={14} weight="bold" tone="secondary" style={{flex: 1}}>
                {draftRange ? rangeLabel(draftRange) : 'Tap the first day, then the last'}
              </AppText>
              <ActionButton label="Apply" onPress={() => draftRange && apply(draftRange)} disabled={!draftRange} height={46} size={15} />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
