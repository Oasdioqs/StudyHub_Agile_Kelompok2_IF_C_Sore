import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { colors } from '../lib/theme'

export default function Index() {
  const { token, ready } = useAuth()

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (token) return <Redirect href="/(tabs)" />
  return <Redirect href="/login" />
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
