import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DAYS_HI = ['Raviwar', 'Somwar', 'Mangalwar', 'Budhwar', 'Guruwar', 'Shukrawar', 'Shaniwar'];

const ALL_TASKS = [
  { id: 'durga_chalisa', name: 'Durga Chalisa padhna', sub: 'Roz karna hai — khud padhna', days: [0,1,2,3,4,5,6], color: '#7F77DD' },
  { id: 'hanuman_mandir', name: 'Hanuman Ji — Mandir jaana', sub: 'Prasad chadhao ya gud ka daan karo', days: [2], color: '#EF9F27' },
  { id: 'durga_mandir', name: 'Durga Ji — Mandir jaana', sub: 'Laal phool chadhao', days: [5], color: '#D85A30' },
  { id: 'ganesh_durva', name: 'Ganesh Ji ko Durva chadhana', sub: 'Durva = ghaas hoti hai', days: [5], color: '#D85A30' },
  { id: 'shlok_jaap', name: 'Shlok ka jaap karna', sub: 'Sulakshana patni praapti shlok (#14)', days: [5], color: '#D85A30' },
  { id: 'sundarkand', name: 'Sundarkand padhna', sub: 'Manu ko khud karna hai', days: [6], color: '#378ADD' },
];

const CAUTIONS = [
  'Reed ki haddi — wazan bilkul mat uthao',
  'Band gaadi mein mat baaitho (jo kafi time se nahi chali)',
  'Ghar se bahar nikalte waqt haath mein paani lo',
  '100-200 km travel mein savdhaan rehna',
  'Ghar mein pet mat rakho — stray ko feed karo',
];

const UPCOMING = [
  { label: '8 May — Kaal Dasha shuru', sub: 'Health ka extra dhyan rakhna', color: '#E24B4A' },
  { label: 'Saavan se pehle', sub: 'Pooja/kaam kara lena', color: '#1D9E75' },
  { label: 'Navratre mein', sub: 'Shlok ki ek maala karni hai', color: '#7F77DD' },
  { label: 'Jaldi karo — Blood donate', sub: 'Mangalwar tak best hai', color: '#378ADD' },
];

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getTodayTasks() {
  const day = new Date().getDay();
  return ALL_TASKS.filter(t => t.days.includes(day));
}

async function registerForNotifications() {
  if (!Device.isDevice) return;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  // Morning reminder at 8 AM every day
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🙏 Kalpana Aunty Reminder',
      body: 'Aaj ke tasks check karo — Durga Chalisa padhna mat bhoolo!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  // Evening reminder at 8 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Aaj ke tasks baaki hain?',
      body: 'Check karo — koi task reh toh nahi gaya!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

export default function Index() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [streak, setStreak] = useState(0);
  const todayKey = getTodayKey();
  const todayTasks = getTodayTasks();
  const dayName = DAYS_HI[new Date().getDay()];
  const doneTasks = todayTasks.filter(t => checked[t.id]).length;
  const progress = todayTasks.length > 0 ? doneTasks / todayTasks.length : 0;

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('kalpana_' + todayKey);
      if (raw) setChecked(JSON.parse(raw));

      // Calculate streak
      let s = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const key = 'kalpana_' + d.toISOString().split('T')[0];
        const dayTasks = ALL_TASKS.filter(t => t.days.includes(d.getDay()));
        if (dayTasks.length === 0) { d.setDate(d.getDate() - 1); continue; }
        const saved = await AsyncStorage.getItem(key);
        if (!saved) break;
        const data = JSON.parse(saved);
        const allDone = dayTasks.every(t => data[t.id]);
        if (!allDone) break;
        s++;
        d.setDate(d.getDate() - 1);
      }
      setStreak(s);
    } catch {}
  }, [todayKey]);

  useEffect(() => {
    loadData();
    registerForNotifications();
  }, []);

  const toggle = async (id: string) => {
    const updated = { ...checked, [id]: !checked[id] };
    setChecked(updated);
    await AsyncStorage.setItem('kalpana_' + todayKey, JSON.stringify(updated));
    loadData();
  };

  const resetDay = async () => {
    Alert.alert('Reset?', 'Aaj ke saare tasks uncheck ho jaayenge.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('kalpana_' + todayKey);
          setChecked({});
        }
      }
    ]);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Kalpana Aunty</Text>
        <Text style={styles.subtitle}>Abhijay ki Dainik Checklist</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>

      {/* Streak */}
      <View style={styles.streakCard}>
        <Text style={styles.streakNum}>{streak}</Text>
        <View>
          <Text style={styles.streakLabel}>Din ki Streak</Text>
          <Text style={styles.streakSub}>Roz complete karo, streak badhao!</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressBox}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Aaj ka progress — {dayName}</Text>
          <Text style={styles.progressCount}>{doneTasks}/{todayTasks.length}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {/* Today Tasks */}
      <Text style={styles.sectionTitle}>Aaj ke tasks</Text>
      <View style={styles.card}>
        {todayTasks.length === 0 ? (
          <View style={styles.taskRow}>
            <Text style={styles.emptyText}>Aaj koi special task nahi — bas Durga Chalisa! 🙏</Text>
          </View>
        ) : (
          todayTasks.map((task, i) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskRow, i < todayTasks.length - 1 && styles.taskBorder, checked[task.id] && styles.taskDone]}
              onPress={() => toggle(task.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.circle, checked[task.id] && { backgroundColor: task.color, borderColor: task.color }]}>
                {checked[task.id] && <Text style={styles.tick}>✓</Text>}
              </View>
              <View style={styles.taskInfo}>
                <View style={styles.taskNameRow}>
                  <Text style={[styles.taskName, checked[task.id] && styles.taskNameDone]}>{task.name}</Text>
                  <View style={[styles.tag, { backgroundColor: task.color + '22' }]}>
                    <Text style={[styles.tagText, { color: task.color }]}>
                      {task.days.length === 7 ? 'Roz' : task.days.includes(2) ? 'Mangalwar' : task.days.includes(5) ? 'Shukrawar' : 'Shaniwar'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.taskSub}>{task.sub}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Upcoming */}
      <Text style={styles.sectionTitle}>Upcoming / Seasonal</Text>
      <View style={styles.card}>
        {UPCOMING.map((item, i) => (
          <View key={i} style={[styles.upcomingRow, i < UPCOMING.length - 1 && styles.taskBorder]}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <View>
              <Text style={styles.upcomingLabel}>{item.label}</Text>
              <Text style={styles.upcomingSub}>{item.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Cautions */}
      <Text style={styles.sectionTitle}>Savdhaaniyan</Text>
      <View style={styles.card}>
        {CAUTIONS.map((c, i) => (
          <View key={i} style={[styles.upcomingRow, i < CAUTIONS.length - 1 && styles.taskBorder]}>
            <View style={[styles.dot, { backgroundColor: '#E24B4A' }]} />
            <Text style={styles.cautionText}>{c}</Text>
          </View>
        ))}
      </View>

      {/* Shlok */}
      <Text style={styles.sectionTitle}>Jaap ka Shlok</Text>
      <View style={[styles.card, styles.shlokCard]}>
        <Text style={styles.shlokTitle}>Sulakshana Patni Praapti — Shlok #14</Text>
        <Text style={styles.shlokText}>पत्नीं मनोरमां देहि मनोवृत्तानुसारिणीम्।{'\n'}तारिणीं दुर्गसंसारसागरस्य कुलोद्भवाम्॥</Text>
        <Text style={styles.shlokSub}>Achi life partner ke liye Durga Ji se prarthna</Text>
      </View>

      {/* Reset */}
      <TouchableOpacity style={styles.resetBtn} onPress={resetDay}>
        <Text style={styles.resetText}>Aaj ka reset karo</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { padding: 16 },
  header: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  dateBadge: { backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8, borderWidth: 0.5, borderColor: '#333' },
  dateText: { fontSize: 12, color: '#888' },
  streakCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#333' },
  streakNum: { fontSize: 40, fontWeight: '600', color: '#1D9E75', lineHeight: 44 },
  streakLabel: { fontSize: 14, fontWeight: '500', color: '#FFF' },
  streakSub: { fontSize: 12, color: '#888', marginTop: 2 },
  progressBox: { marginBottom: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#888' },
  progressCount: { fontSize: 12, color: '#888' },
  progressBarBg: { height: 6, backgroundColor: '#222', borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#1D9E75', borderRadius: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '500', color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: '#1A1A1A', borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 0.5, borderColor: '#2A2A2A' },
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  taskBorder: { borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A' },
  taskDone: { opacity: 0.5 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#444', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tick: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  taskInfo: { flex: 1 },
  taskNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  taskName: { fontSize: 14, color: '#FFF', fontWeight: '400', flexShrink: 1 },
  taskNameDone: { textDecorationLine: 'line-through', color: '#555' },
  taskSub: { fontSize: 12, color: '#666', marginTop: 2 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  tagText: { fontSize: 10, fontWeight: '500' },
  emptyText: { fontSize: 13, color: '#666', flex: 1 },
  upcomingRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  upcomingLabel: { fontSize: 13, color: '#DDD', fontWeight: '500' },
  upcomingSub: { fontSize: 12, color: '#666', marginTop: 1 },
  cautionText: { fontSize: 13, color: '#CCC', flex: 1 },
  shlokCard: { padding: 16 },
  shlokTitle: { fontSize: 11, color: '#7F77DD', fontWeight: '500', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  shlokText: { fontSize: 16, color: '#EEE', lineHeight: 26, fontWeight: '400' },
  shlokSub: { fontSize: 12, color: '#666', marginTop: 8 },
  resetBtn: { borderWidth: 0.5, borderColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' },
  resetText: { fontSize: 13, color: '#666' },
});