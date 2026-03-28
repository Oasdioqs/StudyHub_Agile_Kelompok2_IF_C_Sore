import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth-context'
import { fetchDashboardStats, type DashboardStats } from '../../lib/api'
import { colors, radii, shadows, space } from '../../lib/theme'

function ProgressBar({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${v}%` }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primaryBright,
  },
})

function MiniCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string
  value: string | number
  subtitle?: string
  tone?: 'default' | 'warn' | 'ok'
}) {
  const border =
    tone === 'warn'
      ? 'rgba(245, 158, 11, 0.45)'
      : tone === 'ok'
        ? 'rgba(16, 185, 129, 0.45)'
        : colors.border
  return (
    <View style={[mc.card, { borderColor: border }]}>
      <Text style={mc.title}>{title}</Text>
      <Text style={mc.value}>{value}</Text>
      {subtitle ? <Text style={mc.sub}>{subtitle}</Text> : null}
    </View>
  )
}

const mc = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
  },
  title: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  value: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
})

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { token, user } = useAuth()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setErr('')
    try {
      const s = await fetchDashboardStats(token)
      setData(s)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      setLoading(true)
      load()
    }
  }, [token, load])

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>Halo,</Text>
          <Text style={styles.name}>{user?.name || user?.email || 'Pelajar'}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipTxt}>StudyHub</Text>
        </View>
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load()
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {err ? (
            <View style={styles.errBanner}>
              <Text style={styles.errTxt}>{err}</Text>
            </View>
          ) : null}

          {data ? (
            <>
              <View style={[styles.heroCard, shadows.topbar]}>
                <Text style={styles.heroLabel}>Progres hari ini</Text>
                <Text style={styles.heroPct}>{data.progress}%</Text>
                <ProgressBar value={data.progress} />
                <Text style={styles.heroFoot}>
                  {data.doneToday} dari {data.totalToday} tugas hari ini selesai
                </Text>
              </View>

              <View style={styles.row}>
                <MiniCard title="Terlambat" value={data.overdueCount} tone="warn" />
                <MiniCard title="Mendatang" value={data.upcomingDue} />
              </View>

              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Tugas hari ini</Text>
                <Text style={styles.sectionMeta}>{data.todayTasks.length} item</Text>
              </View>
              {data.todayTasks.length === 0 ? (
                <Text style={styles.empty}>Tidak ada tugas dengan deadline hari ini. Santai dulu ☕</Text>
              ) : (
                data.todayTasks.slice(0, 6).map((t) => (
                  <View key={t.id} style={styles.taskRow}>
                    <View style={styles.dot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={2}>
                        {t.title}
                      </Text>
                      {t.subject ? (
                        <Text style={styles.taskSub}>{t.subject}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.badge, t.status === 'DONE' ? styles.badgeOk : styles.badgePending]}>
                      {t.status === 'DONE' ? 'Selesai' : 'Proses'}
                    </Text>
                  </View>
                ))
              )}

              {data.upcomingTasks.length > 0 ? (
                <>
                  <View style={[styles.sectionHead, { marginTop: space.lg }]}>
                    <Text style={styles.sectionTitle}>Mendatang</Text>
                  </View>
                  {data.upcomingTasks.slice(0, 4).map((t) => (
                    <View key={t.id} style={styles.taskRow}>
                      <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskTitle} numberOfLines={2}>
                          {t.title}
                        </Text>
                        <Text style={styles.taskSub}>
                          {t.deadline
                            ? new Date(t.deadline).toLocaleString('id-ID', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.lg,
  },
  greet: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.chipPrimaryBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTxt: { color: colors.chipPrimaryText, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, paddingVertical: 48, alignItems: 'center' },
  errBanner: {
    padding: space.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    marginBottom: space.md,
  },
  errTxt: { color: colors.errorText, fontSize: 14 },
  heroCard: {
    padding: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  heroLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  heroPct: {
    marginTop: 4,
    fontSize: 40,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  heroFoot: { marginTop: space.md, color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionMeta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryBright,
  },
  taskTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  taskSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeOk: { backgroundColor: '#dcfce7', color: '#166534' },
  badgePending: { backgroundColor: colors.chipPrimaryBg, color: colors.chipPrimaryText },
})
