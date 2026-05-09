import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
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

  const jrAnim = useRef(new Animated.Value(0)).current;
  const srAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(jrAnim, { toValue: jrPct, duration: 800, delay: 100, useNativeDriver: false }),
      Animated.timing(srAnim, { toValue: srPct, duration: 800, delay: 100, useNativeDriver: false }),
    ]).start();
  }, [jrPct, srPct]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>CAPITAL STACK</Text>
        <Text style={styles.total}>{formatUSD(total, true)} TVL</Text>
      </View>

      {/* Segmented track with animated widths */}
      <View style={styles.track}>
        <Animated.View style={[
          styles.jrBar,
          { flex: jrAnim },
          jrPct > 0 && {
            shadowColor: colors.signal,
            shadowOpacity: 0.5,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]} />
        <Animated.View style={[styles.srBar, { flex: srAnim }]} />
      </View>

      {/* Inline labels showing % */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.signal }]} />
          <View>
            <Text style={styles.legendAmt}>{formatUSD(juniorCapital, true)}</Text>
            <Text style={styles.legendKey}>First-loss · {(jrPct * 100).toFixed(0)}%</Text>
          </View>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
          <View>
            <Text style={styles.legendAmt}>{formatUSD(seniorCapital, true)}</Text>
            <Text style={styles.legendKey}>Senior · {(srPct * 100).toFixed(0)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontSize: 9, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Courier',
  },
  total: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  track: {
    flexDirection: 'row', height: 10, borderRadius: radius.full,
    overflow: 'hidden', gap: 2, backgroundColor: colors.surfaceHigh,
  },
  jrBar: { backgroundColor: colors.signal, borderRadius: radius.full },
  srBar: { backgroundColor: colors.borderStrong, borderRadius: radius.full },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  legendAmt: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  legendKey: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier', marginTop: 1 },
});
