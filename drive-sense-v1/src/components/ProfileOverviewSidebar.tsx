import React from 'react';
import {Image, Text, TouchableOpacity, View, type StyleProp, type ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '../theme/appTheme';
import {vehicleImageSource} from '../utils/vehicleImage';

/** One radius scale. Anything outside these three is a bug. */
const RADIUS = {sm: 16, md: 20, lg: 28} as const;
/** Minimum comfortable touch target. */
const HIT = 44;

export type ProfileMenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export type ProfileOverviewSidebarProps = {
  account: {
    initial: string;
    /** Identity line. The API exposes no display name, so this is the email. */
    primary: string;
    /** Supporting line, e.g. "Member since Aug 2026". Empty hides it. */
    secondary?: string;
  };
  stats: Array<{
    value: string;
    label: string;
  }>;
  activeVehicle: {
    title: string;
    name: string;
    plate: string;
    imageUrl?: string | null;
  };
  menuItems: ProfileMenuItem[];
  onMenuItemPress?: (item: ProfileMenuItem) => void;
  /** Rendered under the menu. The drawer needs it as much as the Profile tab does. */
  onLogout?: () => void;
  /**
   * `card` stacks bordered cards, which is right on a page background. `plain` drops the chrome for
   * the drawer, where bordered cards inside a panel read as boxes within a box.
   */
  variant?: 'card' | 'plain';
  style?: StyleProp<ViewStyle>;
};

/**
 * The single owner of the profile blocks. `ProfileScreen` and `AppSidebar` both render this instead
 * of keeping two drifting copies of the same summary / stats / vehicle / menu stack.
 */
export const ProfileOverviewSidebar: React.FC<ProfileOverviewSidebarProps> = ({
  account,
  stats,
  activeVehicle,
  menuItems,
  onMenuItemPress,
  onLogout,
  variant = 'card',
  style,
}) => {
  const theme = useAppTheme();
  const isPlain = variant === 'plain';
  const block = isPlain
    ? {backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0}
    : {backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1};
  const blockPadding = isPlain ? 0 : 16;

  return (
    <View style={style}>
      <View
        className="mb-[14px] flex-row items-center"
        style={{
          borderRadius: RADIUS.lg,
          padding: blockPadding,
          ...block,
        }}>
        <View
          className="mr-[14px] size-[64px] items-center justify-center"
          style={{
            borderRadius: RADIUS.md,
            backgroundColor: theme.accentSoft,
          }}>
          <Text style={{color: theme.accent, ...theme.typography.statHero, fontSize: 26, lineHeight: 32}}>
            {account.initial}
          </Text>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.cardTitle}}>
            {account.primary}
          </Text>
          {account.secondary ? (
            <Text
              numberOfLines={1}
              className="mt-1"
              style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {account.secondary}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        className="mb-[14px]"
        style={{
          borderRadius: RADIUS.lg,
          paddingVertical: isPlain ? 12 : blockPadding,
          paddingHorizontal: blockPadding,
          borderTopWidth: isPlain ? 1 : 0,
          borderBottomWidth: isPlain ? 1 : 0,
          borderTopColor: theme.cardBorder,
          borderBottomColor: theme.cardBorder,
          ...(isPlain ? {} : block),
        }}>
        <View className="flex-row">
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingRight: index < stats.length - 1 ? 10 : 0,
                marginRight: index < stats.length - 1 ? 10 : 0,
                borderRightWidth: index < stats.length - 1 ? 1 : 0,
                borderRightColor: theme.cardBorder,
              }}>
              <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.metricValue}}>
                {stat.value}
              </Text>
              <Text numberOfLines={1} style={{color: theme.textSubtle, ...theme.typography.caption, marginTop: 3}}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="mb-[14px]"
        style={{
          borderRadius: RADIUS.lg,
          padding: isPlain ? 0 : 12,
          paddingVertical: isPlain ? 4 : 12,
          ...block,
        }}>
        <Text className="mb-2.5" style={{color: theme.textSubtle, ...theme.typography.caption, letterSpacing: 0.8}}>
          {(activeVehicle.title || 'Vehicle').toUpperCase()}
        </Text>
        <View className="flex-row items-center">
          <View
            className="mr-3 h-14 w-[80px] items-center justify-center overflow-hidden"
            style={{
              borderRadius: RADIUS.sm,
              backgroundColor: theme.cardSoft,
            }}>
            <Image
              source={vehicleImageSource(activeVehicle.imageUrl)}
              style={{width: '100%', height: '100%'}}
              resizeMode="contain"
            />
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} style={{color: theme.text, ...theme.typography.sectionTitle}}>
              {activeVehicle.name}
            </Text>
            <Text numberOfLines={1} className="mt-0.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>
              {activeVehicle.plate}
            </Text>
          </View>
        </View>
      </View>

      <View
        className="overflow-hidden"
        style={{
          borderRadius: isPlain ? 0 : RADIUS.lg,
          ...block,
        }}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => onMenuItemPress?.(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            className="flex-row items-center"
            style={{
              paddingHorizontal: isPlain ? 0 : 14,
              minHeight: HIT,
              paddingVertical: 12,
              borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
              borderBottomColor: theme.cardBorder,
            }}>
            <Ionicons name={item.icon} size={18} color={theme.textSubtle} />
            <Text className="ml-3 flex-1" style={{color: theme.text, ...theme.typography.body}}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSubtle} />
          </TouchableOpacity>
        ))}
      </View>

      {onLogout ? (
        <TouchableOpacity
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          className="mt-[18px] flex-row items-center justify-center"
          style={{
            minHeight: 52,
            borderRadius: RADIUS.md,
            backgroundColor: isPlain ? theme.dangerSoft : theme.card,
            borderWidth: 1,
            borderColor: isPlain ? 'transparent' : theme.cardBorder,
          }}>
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text className="ml-2" style={{color: theme.danger, ...theme.typography.sectionTitle}}>
            Log out
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
