import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';

import Colors, { RADIUS, SPACING } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function useTheme() {
  const scheme = useColorScheme() ?? 'light';
  return Colors[scheme];
}

// 작은 텍스트 wrapper — 색상 토큰을 props 로 받는다.
export function Text({
  tone = 'text',
  weight = 'regular',
  size = 14,
  style,
  children,
  ...rest
}: TextProps & {
  tone?: 'text' | 'muted' | 'brand' | 'danger' | 'accent' | 'invert';
  weight?: 'regular' | 'medium' | 'bold';
  size?: number;
  children?: ReactNode;
}) {
  const t = useTheme();
  const color =
    tone === 'muted'
      ? t.textMuted
      : tone === 'brand'
        ? t.brand
        : tone === 'danger'
          ? t.danger
          : tone === 'accent'
            ? t.accent
            : tone === 'invert'
              ? t.surface
              : t.text;
  const fontWeight = weight === 'bold' ? '700' : weight === 'medium' ? '600' : '400';
  return (
    <RNText style={[{ color, fontSize: size, fontWeight }, style]} {...rest}>
      {children}
    </RNText>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: t.border,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  size = 'md',
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary'
      ? t.brand
      : variant === 'danger'
        ? t.danger
        : variant === 'secondary'
          ? t.surfaceMuted
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? '#fff'
      : variant === 'secondary'
        ? t.text
        : t.brand;
  const padV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padH = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 15;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: RADIUS.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : null}
      <RNText style={{ color: fg, fontSize, fontWeight: '600' }}>{title}</RNText>
    </Pressable>
  );
}

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: RADIUS.pill,
        backgroundColor: selected ? t.brand : t.surfaceMuted,
        opacity: pressed ? 0.85 : 1,
        marginRight: 6,
        marginBottom: 6,
      })}
    >
      <RNText
        style={{
          color: selected ? '#fff' : t.text,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.border, marginVertical: SPACING.md }} />;
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
        paddingHorizontal: 2,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text size={18} weight="bold">{title}</Text>
        {subtitle ? (
          <Text size={12} tone="muted" style={{ marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'text',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'text' | 'brand' | 'accent' | 'danger';
}) {
  return (
    <View>
      <Text size={11} tone="muted">{label}</Text>
      <Text size={26} weight="bold" tone={tone} style={{ marginTop: 2 }}>{value}</Text>
      {hint ? (
        <Text size={11} tone="muted" style={{ marginTop: 2 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
      <Text size={15} weight="medium">{title}</Text>
      {description ? (
        <Text size={12} tone="muted" style={{ marginTop: 6, textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

// 카테고리/색상별로 일관된 컬러 팔레트
export const CATEGORY_COLORS: Record<string, string> = {
  top: '#5b6cff',
  bottom: '#3aaed8',
  outer: '#7a5cff',
  dress: '#ff6fa1',
  shoes: '#ff8b3d',
  bag: '#48b988',
  acc: '#f3b13a',
};

export const COLOR_SWATCHES: Record<string, string> = {
  white: '#f5f6ff',
  black: '#1a1a1f',
  gray: '#8a8d99',
  beige: '#d4be9b',
  navy: '#1c2c5b',
  blue: '#3b7bd6',
  red: '#d83b3b',
  green: '#3aa765',
  yellow: '#f0c93a',
  pink: '#e88aa6',
  brown: '#8d5a3b',
};

export function Screen({
  children,
  style,
  scroll,
}: {
  children: ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.background }, style]}>{children}</View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  padded: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },
});
