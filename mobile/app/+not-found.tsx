import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../src/lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }} />
      <View style={styles.container}>
        <Text style={styles.icon}>⬡</Text>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to Vaults →</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12, padding: spacing.xl },
  icon: { fontSize: 48, color: colors.textQuiet },
  title: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
  link: { marginTop: 8 },
  linkText: { fontSize: 14, color: colors.signal, fontWeight: '600' },
});
