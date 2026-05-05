import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../lib/theme';
import { CLUSTER, EXPLORER_BASE } from '../lib/constants';

export type TxState =
  | { type: 'idle' }
  | { type: 'building' }
  | { type: 'signing' }
  | { type: 'confirming' }
  | { type: 'success'; sig: string; demo: boolean }
  | { type: 'error'; message: string };

interface Props {
  state: TxState;
  onClose: () => void;
  label: string;
}

const STEPS = ['building', 'signing', 'confirming', 'success'];

function stepIndex(state: TxState): number {
  if (state.type === 'building') return 0;
  if (state.type === 'signing') return 1;
  if (state.type === 'confirming') return 2;
  if (state.type === 'success') return 3;
  return -1;
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[
      styles.dot,
      done && styles.dotDone,
      active && styles.dotActive,
    ]}>
      {done && <Text style={styles.dotCheck}>✓</Text>}
      {active && <ActivityIndicator size="small" color={colors.bg} />}
    </View>
  );
}

function openExplorer(sig: string) {
  const url = `${EXPLORER_BASE}/tx/${sig}?cluster=${CLUSTER}`;
  Linking.openURL(url);
}

export function TxModal({ state, onClose, label }: Props) {
  const visible = state.type !== 'idle';
  const idx = stepIndex(state);
  const isSuccess = state.type === 'success';
  const isError = state.type === 'error';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSuccess || isError ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={[colors.surface, colors.bg]}
            style={styles.gradient}
          />

          {isError ? (
            <View style={styles.body}>
              <Text style={styles.errorIcon}>✕</Text>
              <Text style={styles.title}>Transaction Failed</Text>
              <Text style={styles.errorMsg}>{(state as any).message}</Text>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : isSuccess ? (
            <View style={styles.body}>
              <View style={styles.successRing}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={styles.title}>{label} Submitted</Text>
              {(state as any).demo ? (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>DEMO MODE — no real transaction</Text>
                </View>
              ) : (
                <Pressable onPress={() => openExplorer((state as any).sig)}>
                  <Text style={styles.sigText} numberOfLines={1}>
                    {(state as any).sig.slice(0, 24)}…
                  </Text>
                  <Text style={styles.explorerLink}>View on Explorer ↗</Text>
                </Pressable>
              )}
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.title}>{label}</Text>
              <View style={styles.stepsRow}>
                {['Build TX', 'Sign', 'Confirm'].map((s, i) => (
                  <React.Fragment key={s}>
                    <View style={styles.stepItem}>
                      <StepDot active={idx === i} done={idx > i} />
                      <Text style={[styles.stepLabel, idx >= i && { color: colors.text }]}>{s}</Text>
                    </View>
                    {i < 2 && <View style={[styles.stepLine, idx > i && styles.stepLineDone]} />}
                  </React.Fragment>
                ))}
              </View>
              <Text style={styles.hint}>
                {idx === 1 ? 'Approve in your wallet app…' :
                 idx === 2 ? 'Waiting for on-chain confirmation…' :
                 'Preparing transaction…'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,12,15,0.88)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 280,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    padding: spacing.xl,
    gap: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
    flex: 0,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  stepLineDone: {
    backgroundColor: colors.signal,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    borderColor: colors.signal,
    backgroundColor: colors.signal,
  },
  dotDone: {
    borderColor: colors.signal,
    backgroundColor: colors.signal,
  },
  dotCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textQuiet,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  successRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.signal,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 32,
    color: colors.signal,
    fontWeight: '700',
  },
  sigText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Courier',
    textAlign: 'center',
  },
  explorerLink: {
    fontSize: 12,
    color: colors.signal,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  demoBadge: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.warning + '55',
  },
  demoBadgeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorIcon: {
    fontSize: 36,
    color: colors.danger,
    fontWeight: '700',
  },
  errorMsg: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeBtn: {
    backgroundColor: colors.signal,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg,
  },
});
