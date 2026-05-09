import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { usePrivateIntentState } from '../hooks/usePrivateIntents';
import type { PrivateIntentActivity, PrivateIntentStage, PrivateIntentStep } from '../lib/privateIntents';

interface Props {
  vaultConfigPubkey?: string;
  mode: 'manager' | 'investor' | 'terminal';
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitting?: boolean;
}

export function PrivateIntentPanel({
  vaultConfigPubkey,
  mode,
  onSubmit,
  submitLabel = 'Seal Private Intent',
  submitDisabled,
  submitting,
}: Props) {
  const { data, isFetching, refetch } = usePrivateIntentState(vaultConfigPubkey);
  const activity = data?.activity.slice(0, 3) ?? [];
  const timeline = data?.timeline ?? [];
  const isBackendPending = data?.guardStatus === 'unknown';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MAGICBLOCK ER</Text>
          <Text style={styles.title}>Private Intent Guard</Text>
          <Text style={styles.copy}>
            {mode === 'manager'
              ? 'Seal route, exact size, and timing before the vault guard proves risk checks.'
              : 'Proof-first activity without exposing the manager strategy in real time.'}
          </Text>
        </View>
        <Pressable style={styles.refresh} onPress={() => refetch()} disabled={isFetching}>
          <Text style={styles.refreshText}>{isFetching ? '...' : 'SYNC'}</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label={data?.guardLabel ?? 'Private intent backend pending'} status={data?.guardStatus ?? 'unknown'} />
        <Text style={styles.latency}>{data?.latencyMs ? `${data.latencyMs}ms proof` : 'proof stream'}</Text>
      </View>

      <View style={styles.metricRow}>
        <Metric label="Pending" value={String(data?.pendingCount ?? 0)} />
        <Metric label="Approved" value={String(data?.approvedCount ?? 0)} />
        <Metric label="Rejected" value={String(data?.rejectedCount ?? 0)} />
      </View>

      <View style={styles.timeline}>
        {timeline.map((step) => <StepRow key={step.id} step={step} />)}
      </View>

      <View style={styles.activityBlock}>
        <Text style={styles.section}>REDACTED ACTIVITY</Text>
        {activity.length === 0 ? (
          <Text style={styles.empty}>
            {isBackendPending
              ? 'Backend endpoints/events are wired; no private-intent state has arrived yet.'
              : 'No sealed intents yet. New activity will hide route, size, and execution slot.'}
          </Text>
        ) : (
          activity.map((item) => <ActivityRow key={item.id} item={item} />)
        )}
      </View>

      {onSubmit && (
        <Pressable
          style={[styles.submit, (submitDisabled || submitting) && styles.submitDisabled]}
          onPress={onSubmit}
          disabled={submitDisabled || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Sealing intent...' : submitLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const color = status === 'online' ? colors.signal : status === 'degraded' ? colors.warning : status === 'offline' ? colors.danger : colors.textQuiet;
  return (
    <View style={[styles.pill, { borderColor: color + '55', backgroundColor: color + '16' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function StepRow({ step }: { step: PrivateIntentStep }) {
  const color = stageColor(step.status);
  return (
    <View style={styles.step}>
      <View style={[styles.stepMark, { borderColor: color, backgroundColor: color + '22' }]} />
      <View style={styles.stepCopy}>
        <View style={styles.stepTop}>
          <Text style={styles.stepLabel}>{step.label}</Text>
          <Text style={[styles.stepStatus, { color }]}>{step.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.stepDetail}>{step.detail}</Text>
      </View>
    </View>
  );
}

function ActivityRow({ item }: { item: PrivateIntentActivity }) {
  return (
    <View style={styles.activity}>
      <View style={styles.activityTop}>
        <Text style={styles.activityTitle}>Intent {item.status}</Text>
        <Text style={styles.activityTime}>{timeLabel(item.occurredAt)}</Text>
      </View>
      <Text style={styles.activityDetail}>{item.detail}</Text>
      <View style={styles.redactedRow}>
        <Text style={styles.redacted}>Route {item.routeCommitment ? shortHash(item.routeCommitment) : 'redacted'}</Text>
        <Text style={styles.redacted}>Size {item.amountBucket}</Text>
        <Text style={styles.redacted}>Guard {item.guardResult}</Text>
      </View>
    </View>
  );
}

function stageColor(status: PrivateIntentStage) {
  if (status === 'complete') return colors.signal;
  if (status === 'active') return colors.warning;
  if (status === 'failed') return colors.danger;
  return colors.textQuiet;
}

function shortHash(value: string) {
  return value.length > 12 ? `${value.slice(0, 5)}...${value.slice(-4)}` : value;
}

function timeLabel(timestamp: number) {
  if (!timestamp) return 'now';
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 14,
  },
  header: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.signal, fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  refresh: {
    minWidth: 48,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  refreshText: { color: colors.textMuted, fontSize: 9, fontFamily: 'Courier', fontWeight: '700' },
  statusRow: { gap: 8 },
  pill: {
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 7 },
  pillText: { flex: 1, fontSize: 11, fontFamily: 'Courier', fontWeight: '700' },
  latency: { color: colors.textQuiet, fontSize: 10, fontFamily: 'Courier' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceElevated, padding: 10 },
  metricLabel: { color: colors.textQuiet, fontFamily: 'Courier', fontSize: 9, textTransform: 'uppercase' },
  metricValue: { color: colors.text, fontFamily: 'Courier', fontSize: 16, fontWeight: '800', marginTop: 3 },
  timeline: { gap: 10 },
  step: { flexDirection: 'row', gap: 10 },
  stepMark: { width: 14, height: 14, borderRadius: 14, borderWidth: 2, marginTop: 3 },
  stepCopy: { flex: 1 },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stepLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stepStatus: { fontSize: 9, fontFamily: 'Courier', fontWeight: '800' },
  stepDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  activityBlock: { gap: 8 },
  section: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 },
  empty: { color: colors.textMuted, fontSize: 12, lineHeight: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12 },
  activity: { borderRadius: radius.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  activityTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  activityTime: { color: colors.textQuiet, fontSize: 10, fontFamily: 'Courier' },
  activityDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  redactedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  redacted: { color: colors.textMuted, fontSize: 9, fontFamily: 'Courier', backgroundColor: colors.bg, paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.full },
  submit: { borderRadius: radius.full, backgroundColor: colors.signal, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
});
