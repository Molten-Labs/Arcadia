import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName;
  focused: boolean;
}

function TabIcon({ name, focused }: TabIconProps) {
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
        <Ionicons
          name={name}
          size={21}
          color={focused ? colors.signal : colors.textQuiet}
        />
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
        tabBarItemStyle: {
          paddingVertical: 6,
        },
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
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'briefcase' : 'briefcase-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="traders"
        options={{
          title: 'Traders',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Manage',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
