import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth-context'
import { createTask, fetchTasks, toggleTaskDone, type Task } from '../../lib/api'
import { colors, radii, space } from '../../lib/theme'

function formatDeadline(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets()
  const { token } = useAuth()
  const [list, setList] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setErr('')
    try {
      const tasks = await fetchTasks(token)
      setList(tasks)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat tugas')
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

  async function onToggle(item: Task) {
    if (!token) return
    const nextDone = item.status !== 'DONE'
    setBusyId(item.id)
    try {
      const updated = await toggleTaskDone(token, item, nextDone)
      setList((prev) => prev.map((t) => (t.id === item.id ? { ...t, ...updated } : t)))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memperbarui')
    } finally {
      setBusyId(null)
    }
  }

  async function onCreate() {
    if (!token || !newTitle.trim()) return
    setSaving(true)
    setErr('')
    try {
      const t = await createTask(token, newTitle.trim(), newSubject.trim() || undefined)
      setList((prev) => [t, ...prev])
      setNewTitle('')
      setNewSubject('')
      setModal(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah tugas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Text style={styles.title}>Tugas</Text>
        <Pressable style={styles.addBtn} onPress={() => setModal(true)}>
          <Text style={styles.addBtnTxt}>+ Baru</Text>
        </Pressable>
      </View>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errTxt}>{err}</Text>
        </View>
      ) : null}

      {loading && list.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
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
          ListEmptyComponent={
            <Text style={styles.empty}>Belum ada tugas. Tambahkan yang pertama.</Text>
          }
          renderItem={({ item }) => {
            const done = item.status === 'DONE'
            return (
              <Pressable
                style={[styles.row, done && styles.rowDone]}
                onPress={() => onToggle(item)}
                disabled={busyId === item.id}
              >
                <View style={[styles.check, done && styles.checkOn]}>
                  {done ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, done && styles.rowTitleDone]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subject ? <Text style={styles.sub}>{item.subject}</Text> : null}
                  <Text style={styles.meta}>{formatDeadline(item.deadline)}</Text>
                </View>
                {busyId === item.id ? <ActivityIndicator color={colors.primary} /> : null}
              </Pressable>
            )
          }}
        />
      )}

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + space.md }]}>
            <Text style={styles.modalTitle}>Tugas baru</Text>
            <Text style={styles.label}>Judul</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Laporan AKSI"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <Text style={styles.label}>Mapel / topik (opsional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Basis Data"
              placeholderTextColor={colors.textMuted}
              value={newSubject}
              onChangeText={setNewSubject}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancel} onPress={() => setModal(false)}>
                <Text style={styles.cancelTxt}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.save, !newTitle.trim() && styles.saveOff]}
                onPress={onCreate}
                disabled={!newTitle.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveTxt}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  addBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.chipPrimaryBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnTxt: { color: colors.chipPrimaryText, fontWeight: '700', fontSize: 14 },
  errBox: {
    marginBottom: space.sm,
    padding: space.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errTxt: { color: colors.errorText, fontSize: 14 },
  center: { flex: 1, paddingVertical: 48, alignItems: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, fontSize: 15 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  rowDone: { opacity: 0.75 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  checkMark: { color: colors.primaryDark, fontWeight: '900', fontSize: 14 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: space.md },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: space.md,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  cancel: { paddingVertical: 12, paddingHorizontal: space.md },
  cancelTxt: { color: colors.textMuted, fontWeight: '600' },
  save: {
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primaryBright,
    minWidth: 120,
    alignItems: 'center',
  },
  saveOff: { opacity: 0.5 },
  saveTxt: { color: '#fff', fontWeight: '800' },
})
