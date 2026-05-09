import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.0, duration: 900, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0.9, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
      ])
    ).start();
  }, []);
  return (
    <View style={dot.wrap}>
      <Animated.View style={[dot.ring, { transform: [{ scale }], opacity: op }]} />
      <View style={dot.core} />
    </View>
  );
}

const dot = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal },
  core: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.signal, position: 'absolute' },
});

export function MarketTicker() {
  const [solPrice, setSolPrice] = useState(parseFloat((148.32 + Math.random() * 4 - 2).toFixed(2)));
  const [solChange, setSolChange] = useState(parseFloat((3.42 + Math.random() * 0.4 - 0.2).toFixed(2)));
  const [tps, setTps] = useState(Math.floor(2800 + Math.random() * 700));
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const iv = setInterval(() => {
      setSolPrice(p => {
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1.15, duration: 160, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start();
        return parseFloat((p + (Math.random() - 0.46) * 0.55).toFixed(2));
      });
      setSolChange(c => parseFloat((c + (Math.random() - 0.5) * 0.07).toFixed(2)));
      setTps(Math.floor(2600 + Math.random() * 900));
    }, 5500);
    return () => clearInterval(iv);
  }, []);

  const changePos = solChange >= 0;

  return (
    <View style={styles.bar}>
      <PulseDot />
      <Text style={styles.live}>LIVE</Text>

      <View style={styles.sep} />

      <Text style={styles.tokenLabel}>SOL</Text>
      <Animated.Text style={[styles.price, { transform: [{ scale: flashAnim }] }]}>
        ${solPrice.toFixed(2)}
      </Animated.Text>
      <Text style={[styles.change, { color: changePos ? colors.signal : colors.danger }]}>
        {changePos ? '▲' : '▼'}{Math.abs(solChange).toFixed(2)}%
      </Text>

      <View style={styles.sep} />

      <Text style={styles.metaLabel}>TPS</Text>
      <Text style={[styles.metaVal, { color: tps > 3000 ? colors.signal : tps > 2000 ? colors.warning : colors.danger }]}>
        {tps.toLocaleString()}
      </Text>

      <View style={styles.sep} />

      <Text style={styles.metaLabel}>JUP</Text>
      <Text style={[styles.metaVal, { color: colors.signal }]}>V6</Text>

      <View style={styles.sep} />

      <Text style={styles.metaLabel}>NET</Text>
      <Text style={[styles.metaVal, { color: colors.warning }]}>DEVNET</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  live: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.signal,
    letterSpacing: 1.2,
    fontFamily: 'Courier',
  },
  sep: { width: 1, height: 16, backgroundColor: colors.border },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textQuiet,
    fontFamily: 'Courier',
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  change: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textQuiet,
    fontFamily: 'Courier',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
});
