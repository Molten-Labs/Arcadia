import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/lib/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Vaults: '⬡',
    Portfolio: '◈',
    Traders: '◎',
    Settings: '◉',
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>
      {icons[label] ?? '○'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.textQuiet,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ focused }) => <TabIcon label="Vaults" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <TabIcon label="Portfolio" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused }) => <TabIcon label="Traders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
