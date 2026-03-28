import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BearHero } from '../components/BearHero'
import { registerAccount } from '../lib/api'
import { colors, loginGradientColors, radii, shadows, space } from '../lib/theme'

export default function RegisterScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const valid = name.trim().length >= 2 && email.includes('@') && password.length >= 8

  async function onSubmit() {
    if (!valid || loading) return
    setError('')
    setLoading(true)
    try {
      await registerAccount(name.trim(), email, password)
      Alert.alert('Berhasil', 'Akun dibuat. Silakan masuk.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mendaftar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient
      colors={[...loginGradientColors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <BearHero style={{ marginBottom: space.sm }} />

          <View style={styles.heroText}>
            <Text style={styles.title}>Daftar StudyHub</Text>
            <Text style={styles.sub}>Buat akun baru di sini.</Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            {error ? (
              <View style={styles.errBox}>
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Nama</Text>
            <TextInput
              style={styles.input}
              placeholder="Nama lengkap"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              editable={!loading}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="nama@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, styles.pwInput]}
                placeholder="Minimal 8 karakter"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPw(!showPw)} style={styles.eye} hitSlop={12}>
                <Text style={styles.eyeTxt}>{showPw ? 'Sembunyi' : 'Lihat'}</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [pressed && valid && !loading && { opacity: 0.94 }]}
              onPress={onSubmit}
              disabled={!valid || loading}
            >
              <LinearGradient
                colors={[colors.primaryBright, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.btnGradient, (!valid || loading) && styles.btnGradientDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnLabel}>Daftar</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.linkRow} onPress={() => router.replace('/login')} disabled={loading}>
              <Text style={styles.link}>Sudah punya akun? Masuk</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
  },
  heroText: {
    alignItems: 'center',
    marginBottom: space.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  sub: {
    marginTop: space.xs,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    borderRadius: radii.lg,
    padding: space.lg,
    backgroundColor: colors.cardGlass,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  errBox: {
    marginBottom: space.md,
    padding: space.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errText: {
    color: colors.errorText,
    fontSize: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: space.xs,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: space.md,
  },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 88, marginBottom: space.md },
  eye: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  eyeTxt: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  btnGradient: {
    marginTop: space.sm,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  btnGradientDisabled: {
    opacity: 0.55,
  },
  btnLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  link: {
    color: colors.primaryBright,
    fontSize: 15,
    fontWeight: '600',
  },
})
