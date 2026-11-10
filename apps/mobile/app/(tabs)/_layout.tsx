import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// SDK 56 expo-router Tabs API. expo-symbols 는 iOS native SF Symbols + android/web fallback.
type IconName = SymbolViewProps['name'];
function TabIcon({ ios, fallback, color }: { ios: string; fallback: string; color: ColorValue }) {
  return (
    <SymbolView
      name={{ ios, android: fallback, web: fallback } as IconName}
      tintColor={color}
      size={26}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.surface },
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="house.fill" fallback="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: '옷장',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="tshirt.fill" fallback="checkroom" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recommend"
        options={{
          title: '추천',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="sparkles" fallback="auto_awesome" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: '통계',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="chart.bar.fill" fallback="bar_chart" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="gearshape.fill" fallback="settings" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
