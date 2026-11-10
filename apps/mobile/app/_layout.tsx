import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { api, setApiUserId } from '@/lib/api';
import { useApp } from '@/lib/store';
import { getOrCreateUserId } from '@/lib/userId';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const setUserId = useApp((s) => s.setUserId);

  // 앱 부트: SecureStore 에 저장된 UUID 를 꺼내거나 새로 만들어 store/api client 에 주입,
  // 그 다음 서버에 user upsert. Clerk 도입 후에는 이 effect 가 Clerk session 으로 바뀐다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getOrCreateUserId();
      if (cancelled) return;
      setApiUserId(id);
      setUserId(id);
      api.ensureMe().catch((err) => {
        console.warn('[boot] ensureMe failed:', err?.message ?? err);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [setUserId]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-clothes"
          options={{ presentation: 'modal', title: '옷 추가' }}
        />
        <Stack.Screen name="clothes/[id]" options={{ title: '옷 상세' }} />
      </Stack>
    </ThemeProvider>
  );
}
