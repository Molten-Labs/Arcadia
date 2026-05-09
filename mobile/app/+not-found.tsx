import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../src/lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{
        title: 'Not Found',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: colors.textMuted }} />
          <View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted }} />
        </View>
        <Text style={styles.title}>Screen not found</Text>
        <Text style={styles.sub}>This page doesn't exist or was moved.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to Vaults</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 10,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  link: { marginTop: 12 },
  linkText: {
    fontSize: 14,
    color: colors.signal,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
