import {useAppTheme} from '../theme/ThemeProvider';
import {HalfTile} from './HalfTile';
import {ProgressRing} from './ProgressRing';

/**
 * Home: drives done this week against the goal set in onboarding, with a progress ring. Without a
 * goal it simply counts this week's drives.
 */
export function WeekGoalTile({target, done}: {target: number | null; done: number}) {
  const c = useAppTheme().colors;
  const met = target != null && done >= target;
  return (
    <HalfTile
      label={target == null ? 'This week' : met ? 'Goal reached' : 'Weekly goal'}
      value={target == null ? String(done) : `${done}/${target}`}
      unit="drives"
      right={
        <ProgressRing
          share={target ? done / target : 0}
          color={met ? c.green : c.accent}
          label={target == null ? `${done} drives this week` : `${done} of ${target} drives this week`}
        />
      }
    />
  );
}
