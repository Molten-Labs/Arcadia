import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

type Status = 'paper' | 'active' | 'cooldown' | 'frozen' | 'closed';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  paper: {
    label: 'Paper',
    color: colors.textMuted,
    bg: 'rgba(82,122,147,0.10)',
    border: 'rgba(82,122,147,0.22)',
  },
  active: {
    label: 'Live',
    color: colors.signal,
    bg: colors.signalDim,
    border: colors.signalBorder,
  },
  cooldown: {
    label: 'Cooldown',
    color: colors.warning,
    bg: colors.warningDim,
    border: colors.warningBorder,
  },
  frozen: {
    label: 'Frozen',
    color: colors.danger,
    bg: colors.dangerDim,
    border: colors.dangerBorder,
  },
  closed: {
    label: 'Closed',
    color: colors.textQuiet,
    bg: 'rgba(46,77,99,0.10)',
    border: 'rgba(46,77,99,0.20)',
  },
};

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status];
  const isActive = status === 'active';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: cfg.bg, borderColor: cfg.border },
      size === 'sm' && styles.badgeSm,
    ]}>
      <View style={[
        styles.dot,
        { backgroundColor: cfg.color },
        isActive && styles.dotActive,
      ]} />
      <Text style={[
        styles.label,
        { color: cfg.color },
        size === 'sm' && styles.labelSm,
      ]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    shadowColor: colors.signal,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: 10,
  },
});
