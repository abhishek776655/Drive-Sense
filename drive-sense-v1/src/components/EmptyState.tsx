import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';
import {useCardStyle} from './Card';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** One sentence: what is missing, and what fills it. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `false` renders bare, for use inside a surface that is already a card. */
  boxed?: boolean;
  compact?: boolean;
};

/**
 * The single empty state used across the app. A new account hits several of these at once —
 * dashboard, trips, garage — so they must read as one deliberate state rather than three
 * differently-worded dead ends. Every one names the next action where there is one.
 */
export const EmptyState: React.FC<Props> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  boxed = true,
  compact = false,
}) => {
  const theme = useAppTheme();
  const cardStyle = useCardStyle();
  const iconSize = compact ? 40 : 52;

  const body = (
    <View style={{alignItems: 'center', paddingVertical: compact ? 8 : 16}}>
      <View
        style={{
          height: iconSize,
          width: iconSize,
          borderRadius: iconSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accentMuted,
          marginBottom: 12,
        }}>
        <Ionicons name={icon} size={compact ? 20 : 24} color={theme.accent} />
      </View>
      <Text style={{color: theme.text, ...theme.typography.sectionTitle, textAlign: 'center'}}>{title}</Text>
      <Text
        style={{
          color: theme.textSubtle,
          ...theme.typography.body,
          textAlign: 'center',
          marginTop: 6,
          maxWidth: 300,
        }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{
            marginTop: 16,
            borderRadius: 999,
            paddingHorizontal: 18,
            minHeight: 44,
            justifyContent: 'center',
            backgroundColor: theme.accent,
          }}>
          <Text style={{color: theme.onAccent, ...theme.typography.body, fontWeight: '800'}}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!boxed) {
    return body;
  }

  return <View style={[cardStyle, {padding: compact ? 14 : 20}]}>{body}</View>;
};
