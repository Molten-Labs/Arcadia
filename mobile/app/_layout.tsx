import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useEffect } from 'react';
import { WalletProvider } from '../src/lib/wallet';
import { colors } from '../src/lib/theme';
import { GuidedDemoOverlay } from '../src/components/GuidedDemoOverlay';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg: string = event?.reason?.message ?? '';
    if (
      msg === 'A network error occurred.' ||
      msg.includes('Failed to fetch') ||
      msg.includes('WebSocket') ||
      msg.includes('timed out') ||
      msg.includes('Network request failed')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="vault/[id]"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.signal,
                  headerShadowVisible: false,
                  headerBackTitle: '',
                }}
              />
              <Stack.Screen
                name="manager/create"
                options={{
                  headerShown: true,
                  headerTitle: 'Launch Vault',
                  headerTitleStyle: { color: colors.text, fontWeight: '600' },
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.signal,
                  headerShadowVisible: false,
                  headerBackTitle: '',
                }}
              />
              <Stack.Screen
                name="manager/vault/[id]"
                options={{
                  headerShown: true,
                  headerTitle: 'Vault Manager',
                  headerTitleStyle: { color: colors.text, fontWeight: '600' },
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.signal,
                  headerShadowVisible: false,
                  headerBackTitle: '',
                }}
              />
              <Stack.Screen
                name="trade"
                options={{
                  headerShown: true,
                  headerTitle: 'Trade Terminal',
                  headerTitleStyle: { color: colors.text, fontWeight: '600' },
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.signal,
                  headerShadowVisible: false,
                  headerBackTitle: '',
                }}
              />
              <Stack.Screen
                name="trader/[wallet]"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.signal,
                  headerShadowVisible: false,
                  headerBackTitle: '',
                }}
              />
            </Stack>
            <GuidedDemoOverlay />
          </WalletProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
