import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/lib/theme';

function Icon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35, color: focused ? colors.signal : colors.textMuted }}>
      {glyph}
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
          height: 72,
          paddingBottom: 12,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.textQuiet,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ focused }) => <Icon glyph="⬡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <Icon glyph="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused }) => <Icon glyph="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <Icon glyph="◉" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
