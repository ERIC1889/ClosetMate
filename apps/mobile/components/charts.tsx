import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Text, useTheme } from './ui';

// 단순 도넛 차트. svg circle 의 strokeDasharray 트릭으로 그린다.
// segments 는 큰 값부터 정렬해서 넘기는 게 시각적으로 깔끔.

export type DonutSegment = {
  key: string;
  value: number;
  color: string;
  label?: string;
};

export function DonutChart({
  segments,
  size = 160,
  thickness = 18,
  center,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const t = useTheme();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // 누적 offset 으로 각 segment 의 시작점 계산
  let cum = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const rotation = (cum / total) * 360 - 90; // 12시 방향에서 시작
    cum += s.value;
    return { ...s, dash, gap, rotation };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={t.surfaceMuted}
          strokeWidth={thickness}
          fill="transparent"
        />
        {arcs.map((a) => (
          <G key={a.key} rotation={a.rotation} originX={cx} originY={cy}>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeLinecap="butt"
              fill="transparent"
            />
          </G>
        ))}
      </Svg>
      {center ? (
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {center}
        </View>
      ) : null}
    </View>
  );
}

// 색상 컬러칩이 들어간 legend 행
export function LegendRow({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: color,
          }}
        />
        <Text size={13}>{label}</Text>
      </View>
      <Text size={13} tone="muted">
        {value} <Text size={12} tone="muted">({pct}%)</Text>
      </Text>
    </View>
  );
}
