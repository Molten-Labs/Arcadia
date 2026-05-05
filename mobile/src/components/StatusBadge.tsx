import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

type Status = 'paper' | 'active' | 'cooldown' | 'frozen' | 'closed';

const STATUS_LABELS: Record<Status, string> = {
  paper: 'PAPER',
  active: 'ACTIVE',
  cooldown: 'COOL',
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
  const small = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { borderColor: color + '40', backgroundColor: color + '14' },
      small && styles.badgeSm,
    ]}>
      <View style={[styles.dot, { backgroundColor: color }, small && styles.dotSm]} />
      <Text style={[styles.label, { color }, small && styles.labelSm]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
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
  dotSm: { width: 4, height: 4 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    fontFamily: 'Courier',
  },
  labelSm: { fontSize: 9 },
});
