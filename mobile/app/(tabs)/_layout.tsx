import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Platform } from 'react-native';
import { colors } from '../../src/lib/theme';

type TabShape = 'vaults' | 'portfolio' | 'traders' | 'manage' | 'settings';

function TabShapeIcon({ shape, color }: { shape: TabShape; color: string }) {
  switch (shape) {
    case 'vaults':
      return (
        <View style={{ gap: 3, alignItems: 'center' }}>
          <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 8, height: 3, borderRadius: 2, backgroundColor: color }} />
        </View>
      );
    case 'portfolio':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 }}>
          <View style={{ width: 5, height: 8, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 5, height: 12, borderRadius: 2, backgroundColor: color }} />
        </View>
      );
    case 'traders':
      return (
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, marginLeft: -6 }} />
        </View>
      );
    case 'manage':
      return (
        <View style={{ gap: 3 }}>
          <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: color }} />
          <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: color }} />
        </View>
      );
    case 'settings':
      return (
        <View style={{
          width: 16, height: 16, borderRadius: 8,
          borderWidth: 3, borderColor: color,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
        </View>
      );
  }
}

interface TabIconProps {
  shape: TabShape;
  focused: boolean;
  color: string;
}

function TabIcon({ shape, focused, color }: TabIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.10 : 1,
        useNativeDriver: Platform.OS !== 'web',
        damping: 16,
        stiffness: 320,
      }),
      Animated.timing(bgOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={[styles.indicator, { opacity: bgOpacity }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <TabShapeIcon shape={shape} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
  },
  indicator: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.signalDim,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          height: 68,
          borderRadius: 34,
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.40,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.textQuiet,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ focused, color }) => <TabIcon shape="vaults" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused, color }) => <TabIcon shape="portfolio" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused, color }) => <TabIcon shape="traders" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Manage',
          tabBarIcon: ({ focused, color }) => <TabIcon shape="manage" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => <TabIcon shape="settings" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
