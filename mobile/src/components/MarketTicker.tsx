import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../lib/theme';

interface TickerItem {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  highlight?: boolean;
}

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.dotCore} />
    </View>
  );
}

export function MarketTicker() {
  const [solPrice, setSolPrice] = useState(148.32 + Math.random() * 4 - 2);
  const [solChange, setSolChange] = useState(3.42 + Math.random() * 0.5 - 0.25);
  const [tps, setTps] = useState(Math.floor(2800 + Math.random() * 800));

  const priceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setSolPrice(p => {
        const next = p + (Math.random() - 0.46) * 0.6;
        Animated.sequence([
          Animated.timing(priceAnim, { toValue: 1.12, duration: 180, useNativeDriver: true }),
          Animated.timing(priceAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
        return parseFloat(next.toFixed(2));
      });
      setSolChange(c => parseFloat((c + (Math.random() - 0.5) * 0.08).toFixed(2)));
      setTps(Math.floor(2600 + Math.random() * 900));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const items: TickerItem[] = [
    {
      label: 'SOL',
      value: `$${solPrice.toFixed(2)}`,
      sub: `${solChange >= 0 ? '+' : ''}${solChange.toFixed(2)}%`,
      positive: solChange >= 0,
      highlight: true,
    },
    {
      label: 'NETWORK TPS',
      value: tps.toLocaleString(),
      sub: tps > 3000 ? 'HIGH' : tps > 2000 ? 'MED' : 'LOW',
      positive: tps > 2500,
    },
    {
      label: 'SLOT',
      value: '294.2M',
      sub: '~400ms',
    },
    {
      label: 'DEVNET',
      value: 'LIVE',
      positive: true,
    },
    {
      label: 'JUPITER V6',
      value: 'READY',
      positive: true,
    },
  ];

  return (
    <View style={styles.ticker}>
      <PulseDot />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        scrollEnabled={false}
      >
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <View style={styles.sep} />}
            <View style={styles.item}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              {item.label === 'SOL' ? (
                <Animated.Text
                  style={[
                    styles.itemValue,
                    item.highlight && styles.itemValueHighlight,
                    { transform: [{ scale: priceAnim }] },
                  ]}
                >
                  {item.value}
                </Animated.Text>
              ) : (
                <Text
                  style={[
                    styles.itemValue,
                    item.positive === true && styles.itemValuePositive,
                    item.positive === false && styles.itemValueNegative,
                  ]}
                >
                  {item.value}
                </Text>
              )}
              {item.sub && (
                <Text
                  style={[
                    styles.itemSub,
                    item.positive === true && { color: colors.signal },
                    item.positive === false && { color: colors.danger },
                  ]}
                >
                  {item.sub}
                </Text>
              )}
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    overflow: 'hidden',
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal,
    position: 'absolute',
  },
  dotRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.signal,
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  sep: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 0.8,
    fontFamily: 'Courier',
    textTransform: 'uppercase',
  },
  itemValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  itemValueHighlight: {
    color: colors.text,
    fontSize: 12,
  },
  itemValuePositive: {
    color: colors.signal,
  },
  itemValueNegative: {
    color: colors.danger,
  },
  itemSub: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textQuiet,
    fontFamily: 'Courier',
  },
});
