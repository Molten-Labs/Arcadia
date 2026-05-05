import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WalletProvider } from '../src/lib/wallet';
import { colors } from '../src/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

export default function RootLayout() {
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
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="vault/[id]"
                options={{
                  headerShown: true,
                  title: 'Vault Detail',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.text,
                  headerShadowVisible: false,
                  headerTitleStyle: { fontWeight: '700', fontSize: 16 },
                }}
              />
              <Stack.Screen
                name="trader/[wallet]"
                options={{
                  headerShown: true,
                  title: 'Trader',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.text,
                  headerShadowVisible: false,
                  headerTitleStyle: { fontWeight: '700', fontSize: 16 },
                }}
              />
            </Stack>
          </WalletProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
