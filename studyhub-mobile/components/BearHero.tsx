import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { colors } from '../lib/theme'

type Props = {
  style?: ViewStyle
}

/**
 * Hero di atas login/register. Di web pakai Rive `bear.riv`; di mobile native Rive
 * membutuhkan modul yang sering gagal di EAS Gradle — pakai maskot ikon yang selaras warna brand.
 */
export function BearHero({ style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.circle}>
        <Ionicons name="paw" size={56} color={colors.primaryBright} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
