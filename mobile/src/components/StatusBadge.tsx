import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

type Status = 'paper' | 'active' | 'cooldown' | 'frozen' | 'closed';

const STATUS_LABELS: Record<Status, string> = {
  paper: 'PAPER',
  active: 'ACTIVE',
  cooldown: 'COOLDOWN',
  frozen: 'FROZEN',
  closed: 'CLOSED',
};

const STATUS_COLORS: Record<Status, string> = {
  paper: colors.statusPaper,
  active: colors.statusActive,
  cooldown: colors.statusCooldown,
  frozen: colors.statusFrozen,
  closed: colors.statusClosed,
};

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const small = size === 'sm';

  return (
    <View style={[styles.badge, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <View style={[styles.dot, { backgroundColor: color }, small && styles.dotSm]} />
      <Text style={[styles.label, { color }, small && styles.labelSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  labelSm: {
    fontSize: 9,
  },
});
