// mobile/screens/Auth/RegisterScreen.jsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

const ROLES = [
  { value: 'farmer', label: '🌾 Farmer',  desc: 'Sell crops, list land, offer services' },
  { value: 'buyer',  label: '🛒 Buyer',   desc: 'Buy crops, rent land, book services' },
  { value: 'both',   label: '🔄 Both',    desc: 'I buy and sell' },
];

export default function RegisterScreen({ navigation, onLogin }) {
  const [form, setForm] = useState({
    name: '', phone: '', password: '', role: 'buyer', address: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleRegister = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim())
      return Alert.alert('Validation', 'Name, phone, and password are required.');
    if (form.password.length < 6)
      return Alert.alert('Validation', 'Password must be at least 6 characters.');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name:     form.name.trim(),
        phone:    form.phone.trim(),
        password: form.password,
        role:     form.role,
        address:  form.address.trim() || undefined,
      });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user',  JSON.stringify(data.user));
      onLogin();
    } catch (err) {
      Alert.alert('Registration failed', err.response?.data?.error || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.appName}>AgriApp</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Full Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Gurpreet Singh"
            placeholderTextColor="#aaa"
            value={form.name} onChangeText={v => update('name', v)} />

          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput style={styles.input} placeholder="9876543210"
            placeholderTextColor="#aaa"
            value={form.phone} onChangeText={v => update('phone', v)}
            keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Password *</Text>
          <TextInput style={styles.input} placeholder="Minimum 6 characters"
            placeholderTextColor="#aaa"
            value={form.password} onChangeText={v => update('password', v)}
            secureTextEntry />

          <Text style={styles.fieldLabel}>Address (optional)</Text>
          <TextInput style={styles.input} placeholder="Village, District, State"
            placeholderTextColor="#aaa"
            value={form.address} onChangeText={v => update('address', v)} />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>I am a...</Text>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleCard, form.role === r.value && styles.roleCardActive]}
              onPress={() => update('role', r.value)}
            >
              <View style={styles.roleRow}>
                <View style={[styles.radio, form.role === r.value && styles.radioActive]} />
                <View>
                  <Text style={[styles.roleLabel, form.role === r.value && styles.roleLabelActive]}>
                    {r.label}
                  </Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.link}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#f4f6f3' },
  container:       { padding: 20, paddingBottom: 40 },
  header:          { alignItems: 'center', marginBottom: 24, marginTop: 20 },
  logo:            { fontSize: 48 },
  appName:         { fontSize: 28, fontWeight: '800', color: '#1B6B35', marginTop: 6 },
  tagline:         { fontSize: 14, color: '#666', marginTop: 2 },
  card:            {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input:           {
    backgroundColor: '#f8f9f8', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', color: '#222',
  },
  roleCard:        {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 12, marginTop: 8, backgroundColor: '#fafafa',
  },
  roleCardActive:  { borderColor: '#1B6B35', backgroundColor: '#f0faf4' },
  roleRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio:           { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc' },
  radioActive:     { borderColor: '#1B6B35', backgroundColor: '#1B6B35' },
  roleLabel:       { fontSize: 14, fontWeight: '700', color: '#333' },
  roleLabelActive: { color: '#1B6B35' },
  roleDesc:        { fontSize: 12, color: '#888', marginTop: 2 },
  btn:             {
    backgroundColor: '#1B6B35', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnDisabled:     { backgroundColor: '#76a882' },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow:         { alignItems: 'center', marginTop: 16 },
  linkText:        { fontSize: 14, color: '#666' },
  link:            { color: '#1B6B35', fontWeight: '700' },
});
