import React from 'react';
import { Alert, Pressable, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
        style={({ pressed }) => [styles.connectedBtn, pressed && { opacity: 0.7 }]}
        onPress={handlePress}
      >
        <View style={[styles.statusDot, { backgroundColor: isDemoWallet ? colors.warning : colors.signal }]} />
        <Text style={styles.connectedAddr}>
          {truncateAddress(publicKey, 4)}
          {isDemoWallet ? ' ◐' : ''}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.85 }]}
      onPress={handlePress}
      disabled={connecting}
    >
      <LinearGradient
        colors={[colors.signal, colors.signalDeep]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {connecting
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Text style={styles.connectText}>Connect</Text>
        }
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  connectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  connectedAddr: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  connectBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gradient: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  connectText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
