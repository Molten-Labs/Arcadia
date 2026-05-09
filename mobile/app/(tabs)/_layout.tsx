import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors, radius } from '../../src/lib/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, focused && styles.iconActive]}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '22',
  },
  icon: {
    fontSize: 18,
    color: colors.textQuiet,
  },
  iconActive: {
    color: colors.signal,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 78,
          paddingBottom: 16,
          paddingTop: 8,
          shadowColor: colors.ink,
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -8 },
        },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.textQuiet,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          fontFamily: 'Courier',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⬡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Manager',
          tabBarIcon: ({ focused }) => <TabIcon glyph="▣" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
