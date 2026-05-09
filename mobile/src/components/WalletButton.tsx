import React from 'react';
import { Alert, Pressable, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { useWallet } from '../lib/wallet';
import { truncateAddress } from '../lib/format';

interface Props {
  onPress?: () => void;
}

export function WalletButton({ onPress }: Props) {
  const { connected, connecting, publicKey, connect, isDemoWallet } = useWallet();

  const handlePress = async () => {
    if (onPress) { onPress(); return; }
    if (!connected && !connecting) {
      try {
        await connect();
      } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
    }
  };

  if (connected && publicKey) {
    return (
      <Pressable
        style={({ pressed }) => [styles.connectedBtn, pressed && styles.pressed]}
        onPress={handlePress}
      >
        <View style={[
          styles.statusDot,
          { backgroundColor: isDemoWallet ? colors.warning : colors.signal },
        ]} />
        <Text style={styles.connectedAddr}>
          {truncateAddress(publicKey, 4)}
        </Text>
        {isDemoWallet && (
          <View style={styles.demoPill}>
            <Text style={styles.demoLabel}>DEMO</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.connectBtn, pressed && styles.pressed]}
      onPress={handlePress}
      disabled={connecting}
    >
      <LinearGradient
        colors={[colors.signal, colors.signalDeep]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {connecting ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <View style={styles.connectInner}>
            <Ionicons name="wallet-outline" size={14} color={colors.white} />
            <Text style={styles.connectText}>Connect</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  connectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedAddr: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
    fontFamily: 'Courier',
  },
  demoPill: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  connectBtn: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  connectInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  pressed: {
    opacity: 0.75,
  },
});
