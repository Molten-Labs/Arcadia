import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../../src/lib/theme';

function TabIcon({ glyph, focused, label }: { glyph: string; focused: boolean; label: string }) {
  const glow = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.18 : 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 300,
      }),
      Animated.timing(glow, {
        toValue: focused ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const glowStyle = {
    opacity: glow,
    shadowColor: colors.signal,
    shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  };

  return (
    <View style={tabStyles.wrap}>
      <Animated.View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive, { transform: [{ scale }] }]}>
        <Animated.Text style={[tabStyles.icon, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }, tabStyles.iconGlow]}>
          {glyph}
        </Animated.Text>
        <Text style={[tabStyles.icon, tabStyles.iconBase, focused && tabStyles.iconActive]}>
          {glyph}
        </Text>
      </Animated.View>
      {focused && (
        <Animated.View style={[tabStyles.dot, { opacity: glow }]} />
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: colors.signalDim,
  },
  iconBase: { position: 'absolute' },
  iconGlow: {
    position: 'absolute',
    fontSize: 19,
    color: colors.signal,
    ...Platform.select({
      web: { filter: 'blur(6px)' },
    }),
  },
  icon: {
    fontSize: 18,
    color: colors.textQuiet,
  },
  iconActive: {
    color: colors.signal,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.signal,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 18,
          paddingTop: 6,
          shadowColor: colors.signal,
          shadowOpacity: 0.06,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: -4 },
          elevation: 20,
        },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.textQuiet,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontFamily: 'Courier',
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⬡" focused={focused} label="Vaults" />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◈" focused={focused} label="Portfolio" />,
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} label="Traders" />,
        }}
      />
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Manager',
          tabBarIcon: ({ focused }) => <TabIcon glyph="▣" focused={focused} label="Manager" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} label="Settings" />,
        }}
      />
    </Tabs>
  );
}
