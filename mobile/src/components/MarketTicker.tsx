import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

const ND = Platform.OS !== 'web';

function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.0, duration: 800, useNativeDriver: ND }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: ND }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: ND }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: ND }),
        ]),
        Animated.delay(1400),
      ])
    ).start();
  }, []);

  return (
    <View style={dot.wrap}>
      <Animated.View style={[dot.ring, { transform: [{ scale }], opacity }]} />
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
  const [solPrice, setSolPrice] = useState(
    parseFloat((148.32 + Math.random() * 4 - 2).toFixed(2))
  );
  const [solChange, setSolChange] = useState(
    parseFloat((3.42 + Math.random() * 0.4 - 0.2).toFixed(2))
  );
  const [tps, setTps] = useState(Math.floor(2800 + Math.random() * 700));
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const iv = setInterval(() => {
      setSolPrice(p => {
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1.08, duration: 140, useNativeDriver: ND }),
          Animated.timing(flashAnim, { toValue: 1, duration: 140, useNativeDriver: ND }),
        ]).start();
        return parseFloat((p + (Math.random() - 0.47) * 0.5).toFixed(2));
      });
      setSolChange(c => parseFloat((c + (Math.random() - 0.5) * 0.06).toFixed(2)));
      setTps(Math.floor(2600 + Math.random() * 900));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const changePos = solChange >= 0;
  const tpsColor = tps > 3000 ? colors.signal : tps > 2000 ? colors.warning : colors.danger;

  return (
    <View style={styles.bar}>
      <View style={styles.liveGroup}>
        <LiveDot />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      <View style={styles.sep} />

      <View style={styles.priceGroup}>
        <Text style={styles.tokenLabel}>SOL</Text>
        <Animated.Text style={[styles.price, { transform: [{ scale: flashAnim }] }]}>
          ${solPrice.toFixed(2)}
        </Animated.Text>
        <Text style={[styles.change, { color: changePos ? colors.signal : colors.danger }]}>
          {changePos ? '+' : ''}{solChange.toFixed(2)}%
        </Text>
      </View>

      <View style={styles.sep} />

      <View style={styles.metaGroup}>
        <Text style={styles.metaLabel}>TPS</Text>
        <Text style={[styles.metaVal, { color: tpsColor }]}>{tps.toLocaleString()}</Text>
      </View>

      <View style={styles.sep} />

      <View style={styles.metaGroup}>
        <Text style={styles.metaLabel}>NETWORK</Text>
        <Text style={[styles.metaVal, { color: colors.warning }]}>Devnet</Text>
      </View>
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
    gap: 12,
  },
  liveGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.signal,
    letterSpacing: 1.2,
  },
  sep: { width: 1, height: 18, backgroundColor: colors.border },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  change: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textQuiet,
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
});
