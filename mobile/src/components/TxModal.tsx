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

function stepIndex(state: TxState): number {
  if (state.type === 'building') return 0;
  if (state.type === 'signing') return 1;
  if (state.type === 'confirming') return 2;
  return -1;
}

const STEPS = ['Build TX', 'Sign', 'Confirm'];

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={styles.stepCol}>
      <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
        {done && <Text style={styles.dotCheck}>✓</Text>}
        {active && <ActivityIndicator size="small" color={colors.bg} />}
      </View>
      <Text style={[styles.stepLabel, (done || active) && { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function openExplorer(sig: string) {
  Linking.openURL(`${EXPLORER_BASE}/tx/${sig}?cluster=${CLUSTER}`);
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
      animationType="slide"
      onRequestClose={isSuccess || isError ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {isError ? (
            <View style={styles.body}>
              <View style={[styles.bigIcon, { borderColor: colors.danger + '50', backgroundColor: colors.dangerDim }]}>
                <Text style={[styles.bigIconText, { color: colors.danger }]}>✕</Text>
              </View>
              <Text style={styles.title}>Transaction Failed</Text>
              <Text style={styles.hint}>{(state as any).message}</Text>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Dismiss</Text>
              </Pressable>
            </View>

          ) : isSuccess ? (
            <View style={styles.body}>
              <View style={[styles.bigIcon, { borderColor: colors.signal + '50', backgroundColor: colors.signalDim }]}>
                <Text style={[styles.bigIconText, { color: colors.signal }]}>✓</Text>
              </View>
              <Text style={styles.title}>Submitted</Text>
              <Text style={styles.subtitle}>{label}</Text>

              {(state as any).demo ? (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>DEMO MODE — simulated only</Text>
                </View>
              ) : (
                <Pressable style={styles.explorerRow} onPress={() => openExplorer((state as any).sig)}>
                  <Text style={styles.sigText} numberOfLines={1}>
                    {(state as any).sig.slice(0, 28)}…
                  </Text>
                  <Text style={styles.explorerLink}>View on Explorer ↗</Text>
                </Pressable>
              )}

              <Pressable style={styles.btn} onPress={onClose}>
                <LinearGradient
                  colors={[colors.signal, colors.signalDeep]}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>

          ) : (
            <View style={styles.body}>
              <Text style={styles.title}>{label}</Text>
              <View style={styles.stepsRow}>
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <StepDot label={s} active={idx === i} done={idx > i} />
                    {i < STEPS.length - 1 && (
                      <View style={[styles.connector, idx > i && styles.connectorDone]} />
                    )}
                  </React.Fragment>
                ))}
              </View>
              <Text style={styles.hint}>
                {idx === 1 ? 'Approve in your wallet…'
                  : idx === 2 ? 'Waiting for confirmation…'
                  : 'Preparing transaction…'}
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    minHeight: 300,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  body: {
    padding: spacing.xl,
    gap: 20,
    alignItems: 'center',
  },
  bigIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIconText: {
    fontSize: 36,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: -12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginVertical: 6,
  },
  stepCol: { alignItems: 'center', gap: 6 },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: colors.signal, backgroundColor: colors.signal },
  dotDone: { borderColor: colors.signal, backgroundColor: colors.signal },
  dotCheck: { fontSize: 18, fontWeight: '700', color: colors.bg },
  stepLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textQuiet,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: 'Courier',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  connectorDone: { backgroundColor: colors.signal },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  explorerRow: { alignItems: 'center', gap: 4 },
  sigText: { fontSize: 11, color: colors.textMuted, fontFamily: 'Courier' },
  explorerLink: { fontSize: 13, color: colors.signal, fontWeight: '600' },
  demoBadge: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
    fontFamily: 'Courier',
  },
  btn: {
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  btnGrad: { paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
  btnSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
