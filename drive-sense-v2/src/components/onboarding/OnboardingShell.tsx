import {useEffect, useState, type ReactNode} from 'react';
import {Keyboard, KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {withAlpha} from '../../theme/color';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {BackChip, ProgressBar} from './controls';
import {FadeUp} from './motion';

/** Account, photo, ride, vehicle, frequency, location, notifications, safety (done has no bar). */
export const ONBOARDING_STEPS = 8;

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * One onboarding page (Rovy): full-bleed accent, back chip and progress along the top, a big title
 * and a line of copy fading in, the step's content, and its button pinned to the bottom.
 */
export function OnboardingShell({
  step,
  onBack,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  hideFooterWhileTyping = false,
}: {
  /** 1-based position for the progress bar; omit to hide it (done). */
  step?: number;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  /** For pages whose fields open suggestions below them: the keyboard plus the button leave no room. */
  hideFooterWhileTyping?: boolean;
}) {
  const c = useAppTheme().colors;
  const insets = useSafeAreaInsets();
  const typing = useKeyboardOpen();
  const body = (
    <>
      <FadeUp index={0}>
        <AppText size={44} weight="black" color={c.onAccent} style={{lineHeight: 50, letterSpacing: -0.5}}>
          {title}
        </AppText>
      </FadeUp>
      {subtitle ? (
        <FadeUp index={1} style={{marginTop: 12}}>
          <AppText size={17} weight="semibold" color={withAlpha(c.onAccent, 0.82)}>
            {subtitle}
          </AppText>
        </FadeUp>
      ) : null}
      <View style={{marginTop: 30, gap: 14}}>{children}</View>
    </>
  );
  return (
    <KeyboardAvoidingView style={{flex: 1, backgroundColor: c.accent}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{paddingTop: insets.top + 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: insets.top + 54}}>
        {onBack ? <BackChip onPress={onBack} /> : <View style={{width: 42, height: 42}} />}
        {step != null ? <ProgressBar step={step} total={ONBOARDING_STEPS} /> : null}
      </View>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal: 24, paddingTop: 34, paddingBottom: 24}}>
          {body}
        </ScrollView>
      ) : (
        <View style={{flex: 1, paddingHorizontal: 24, paddingTop: 34}}>{body}</View>
      )}
      {footer && !(hideFooterWhileTyping && typing) ? <View style={{paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 16, gap: 4}}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
