import type {DriveActivityProps, DriveWeekProps} from './props';

/** The slice of `expo-widgets` the app uses, so the sync code can run (and be tested) without it. */
export interface ActivityHandle {
  update: (props: DriveActivityProps) => Promise<void>;
  end: (dismissal: 'default' | 'immediate' | {after: Date}, props?: DriveActivityProps, contentDate?: Date) => Promise<void>;
}

export interface WidgetsNative {
  activity: {
    start: (props: DriveActivityProps, url?: string) => ActivityHandle;
    getInstances: () => ActivityHandle[];
  };
  week: {updateSnapshot: (props: DriveWeekProps) => void};
  after: (date: Date) => {after: Date};
}

/** Android and web have no Live Activities or WidgetKit; `native.ios.ts` is the iOS build. */
export const widgetsNative = (): WidgetsNative | null => null;
