import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';
import { formatUSD } from '../lib/format';

interface Props {
  juniorCapital: number;
  seniorCapital: number;
}

export function CapitalStack({ juniorCapital, seniorCapital }: Props) {
  const total = juniorCapital + seniorCapital;
  const jrPct = total > 0 ? juniorCapital / total : 0;
  const srPct = total > 0 ? seniorCapital / total : 0;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>CAPITAL STACK</Text>
        <Text style={styles.totalValue}>{formatUSD(total, true)} TVL</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.jrBar,
            { flex: jrPct, backgroundColor: colors.signalDeep },
          ]}
        />
        <View
          style={[
            styles.srBar,
            { flex: srPct, backgroundColor: colors.surfaceHigh },
          ]}
        />
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.signalDeep }]} />
          <Text style={styles.legendLabel}>Junior</Text>
          <Text style={styles.legendValue}>{formatUSD(juniorCapital, true)}</Text>
          <Text style={styles.legendPct}>({(jrPct * 100).toFixed(0)}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.surfaceHigh }]} />
          <Text style={styles.legendLabel}>Senior</Text>
          <Text style={styles.legendValue}>{formatUSD(seniorCapital, true)}</Text>
          <Text style={styles.legendPct}>({(srPct * 100).toFixed(0)}%)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  jrBar: {
    borderRadius: radius.full,
  },
  srBar: {
    borderRadius: radius.full,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
  },
  legendPct: {
    fontSize: 10,
    color: colors.textQuiet,
  },
});
