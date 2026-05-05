import React from 'react';
import { Pressable, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { colors, radius } from '../lib/theme';
import { useWallet } from '../lib/wallet';
import { truncateAddress } from '../lib/format';

interface Props {
  onPress?: () => void;
}

export function WalletButton({ onPress }: Props) {
  const { connected, connecting, publicKey, connect, isDemoWallet } = useWallet();

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    if (!connected && !connecting) connect();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, connected && styles.connected, pressed && styles.pressed]}
      onPress={handlePress}
    >
      {connecting ? (
        <ActivityIndicator size="small" color={colors.signal} />
      ) : (
        <View style={[styles.dot, { backgroundColor: connected ? colors.signal : colors.textQuiet }]} />
      )}
      <Text style={[styles.label, connected && styles.labelConnected]}>
        {connecting ? 'Connecting…' : connected && publicKey
          ? truncateAddress(publicKey, 4) + (isDemoWallet ? ' ◐' : '')
          : 'Connect Wallet'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
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
  connected: {
    borderColor: colors.signal + '55',
    backgroundColor: colors.signalDim,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  labelConnected: {
    color: colors.signal,
  },
});
