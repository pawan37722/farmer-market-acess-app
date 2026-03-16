// mobile/screens/Auth/LoginScreen.jsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

export default function LoginScreen({ navigation, onLogin }) {
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      return Alert.alert('Validation', 'Phone and password are required.');
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone: phone.trim(), password });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user',  JSON.stringify(data.user));
      onLogin();
    } catch (err) {
      Alert.alert('Login failed', err.response?.data?.error || 'Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.appName}>AgriApp</Text>
          <Text style={styles.tagline}>Direct-to-Market Agriculture</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#aaa"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.link}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#f4f6f3' },
  container:   { flex: 1, justifyContent: 'center', padding: 20 },
  header:      { alignItems: 'center', marginBottom: 32 },
  logo:        { fontSize: 56 },
  appName:     { fontSize: 32, fontWeight: '800', color: '#1B6B35', marginTop: 8 },
  tagline:     { fontSize: 14, color: '#666', marginTop: 4 },
  card:        {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  title:       { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  label:       { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input:       {
    backgroundColor: '#f8f9f8',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#222',
  },
  btn:         {
    backgroundColor: '#1B6B35',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { backgroundColor: '#76a882' },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow:     { alignItems: 'center', marginTop: 16 },
  linkText:    { fontSize: 14, color: '#666' },
  link:        { color: '#1B6B35', fontWeight: '700' },
});
