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
      <View style={styles.headerRow}>
        <Text style={styles.label}>CAPITAL STACK</Text>
        <Text style={styles.total}>{formatUSD(total, true)} TVL</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.bar, styles.jrBar, { flex: jrPct }]} />
        <View style={[styles.bar, styles.srBar, { flex: srPct }]} />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.signal }]} />
          <Text style={styles.legendKey}>First-loss</Text>
          <Text style={styles.legendVal}>{formatUSD(juniorCapital, true)}</Text>
          <Text style={styles.legendPct}>{(jrPct * 100).toFixed(0)}%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.surfaceHigh }]} />
          <Text style={styles.legendKey}>Senior</Text>
          <Text style={styles.legendVal}>{formatUSD(seniorCapital, true)}</Text>
          <Text style={styles.legendPct}>{(srPct * 100).toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Courier',
  },
  total: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: colors.surfaceHigh,
  },
  bar: { borderRadius: radius.full },
  jrBar: { backgroundColor: colors.signal },
  srBar: { backgroundColor: colors.borderStrong },
  legend: { flexDirection: 'row', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendKey: { fontSize: 11, color: colors.textMuted },
  legendVal: { fontSize: 11, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  legendPct: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier' },
});
