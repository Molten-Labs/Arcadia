import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius } from '../lib/theme';
import { formatPct } from '../lib/format';

interface Props {
  health: number;
  showLabel?: boolean;
  height?: number;
}

function healthColor(h: number): string {
  if (h >= 0.8) return colors.signal;
  if (h >= 0.6) return colors.warning;
  return colors.danger;
}

export function HealthMeter({ health, showLabel = true, height = 5 }: Props) {
  const pct = Math.max(0, Math.min(1, health));
  const color = healthColor(pct);
  const progress = useSharedValue(pct);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 600 });
  }, [pct, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>Junior Health</Text>
          <Text style={[styles.valueText, { color }]}>{formatPct(pct, 0)}</Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View style={[
          styles.fill,
          fillStyle,
          {
            backgroundColor: color,
            height,
            shadowColor: color,
            shadowOpacity: 0.5,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          },
        ]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  track: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.full },
});
