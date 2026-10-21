import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Brand, Button } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export default function WelcomeScreen() {
  return <SafeAreaView style={styles.page}><View style={styles.top}><Brand /><View style={styles.mark}><Text style={styles.markText}>Build with{ '\n' }confidence.</Text><Text style={styles.sub}>Construction work ekama thanakata. Simple, clear, trustworthy.</Text></View></View><View style={styles.actions}><Button title="Sign in" onPress={() => router.push('/(public)/sign-in')} /><Button title="Create account" variant="quiet" onPress={() => router.push('/(public)/sign-up')} /><Text style={styles.foot}>For Sri Lankan construction teams</Text></View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, justifyContent: 'space-between' }, top: { paddingTop: 20 }, mark: { marginTop: 90 }, markText: { color: colors.ink, fontSize: 43, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 }, sub: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 20, maxWidth: 300 }, actions: { gap: 12, marginBottom: 12 }, foot: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 8 } });
