import { useRouter } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth-context'
import { getApiBaseUrl } from '../../lib/config'
import { colors, radii, space } from '../../lib/theme'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, logout } = useAuth()

  async function onLogout() {
    Alert.alert('Keluar?', 'Anda perlu masuk lagi untuk mengakses data.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + space.lg }]}>
      <Text style={styles.title}>Profil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nama</Text>
        <Text style={styles.value}>{user?.name || '—'}</Text>
        <View style={styles.sep} />
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || '—'}</Text>
        <View style={styles.sep} />
        <Text style={styles.label}>API</Text>
        <Text style={styles.mono} numberOfLines={2}>
          {getApiBaseUrl()}
        </Text>
        <Text style={styles.hint}>Ubah lewat environment variable EXPO_PUBLIC_API_URL saat build / dev.</Text>
      </View>

      <Pressable style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutTxt}>Keluar</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: space.lg },
  card: {
    borderRadius: radii.lg,
    padding: space.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  value: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
  mono: { color: colors.textMuted, fontSize: 13, fontFamily: 'monospace' },
  hint: { marginTop: space.sm, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  logout: {
    marginTop: space.xl,
    paddingVertical: space.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  logoutTxt: { color: colors.errorText, fontSize: 16, fontWeight: '800' },
})
