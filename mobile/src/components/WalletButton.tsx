import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../lib/theme';
import { useWallet } from '../lib/wallet';
import { truncateAddress } from '../lib/format';

export function WalletButton({ onPress }: { onPress?: () => void }) {
  const {
    connected, connecting, publicKey, connect, connectDemoWallet,
    disconnect, isDemoWallet, isMwaAvailable, walletLabel,
  } = useWallet();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleConnectedPress = () => {
    if (onPress) { onPress(); return; }
    Alert.alert(
      walletLabel ?? (isDemoWallet ? 'Demo Wallet' : 'Connected'),
      truncateAddress(publicKey ?? '', 8),
      [
        { text: 'Disconnect', style: 'destructive', onPress: disconnect },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (connected && publicKey) {
    return (
      <Pressable
        style={({ pressed }) => [styles.connectedBtn, pressed && { opacity: 0.75 }]}
        onPress={handleConnectedPress}
      >
        <View style={[
          styles.dot,
          { backgroundColor: isDemoWallet ? colors.warning : colors.signal },
        ]} />
        <Text style={styles.connectedAddr}>{truncateAddress(publicKey, 4)}</Text>
        {isDemoWallet && (
          <View style={styles.demoPill}>
            <Text style={styles.demoLabel}>DEMO</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.8 }]}
        onPress={() => {
          if (onPress) { onPress(); return; }
          setSheetOpen(true);
        }}
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
              <Text style={styles.connectText}>Connect</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Connect Wallet</Text>
            <Text style={styles.sheetSub}>
              {isMwaAvailable
                ? 'Open your Solana wallet app to authorize this connection'
                : 'MWA requires an Android device with Phantom or Solflare installed'}
            </Text>

            {isMwaAvailable && (
              <Pressable
                style={({ pressed }) => [styles.optionBtn, pressed && { opacity: 0.8 }]}
                onPress={async () => {
                  setSheetOpen(false);
                  try { await connect(); }
                  catch (err: any) {
                    Alert.alert('Connection failed', err?.message ?? 'Could not connect wallet');
                  }
                }}
              >
                <LinearGradient
                  colors={[colors.signal + '22', colors.signal + '08']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
                <View style={styles.optionIcon}>
                  <View style={{ width: 18, height: 22, borderRadius: 4, borderWidth: 2.5, borderColor: colors.signal }} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Mobile Wallet Adapter</Text>
                  <Text style={styles.optionDesc}>Phantom · Solflare · Any MWA wallet</Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.textMuted }}>›</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [styles.optionBtn, styles.optionBtnDemo, pressed && { opacity: 0.8 }]}
              onPress={async () => {
                setSheetOpen(false);
                await connectDemoWallet();
              }}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.warningDim }]}>
                <View style={{ width: 6, height: 14, borderRadius: 3, backgroundColor: colors.warning, marginTop: 4 }} />
                <View style={{ width: 10, height: 8, borderRadius: 3, backgroundColor: colors.warning, marginTop: -2 }} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Demo Mode</Text>
                <Text style={styles.optionDesc}>Explore with simulated data — no wallet needed</Text>
              </View>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>›</Text>
            </Pressable>

            {!isMwaAvailable && (
              <View style={styles.mwaHint}>
                <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700' }}>i</Text>
                </View>
                <Text style={styles.mwaHintText}>
                  To use MWA: open this app on an Android device with Phantom or Solflare installed
                </Text>
              </View>
            )}

            <Pressable style={styles.cancelBtn} onPress={() => setSheetOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
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
  dot: { width: 6, height: 6, borderRadius: 3 },
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

  connectBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  connectInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectText: { fontSize: 13, fontWeight: '700', color: colors.white },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,8,16,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sheetSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
    marginBottom: 4,
  },

  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  optionBtnDemo: {
    borderColor: colors.border,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionDesc: { fontSize: 12, color: colors.textMuted },

  mwaHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  mwaHintText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
});
