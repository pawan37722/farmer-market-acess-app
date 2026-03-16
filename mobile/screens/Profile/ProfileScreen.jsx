// mobile/screens/Profile/ProfileScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import api, { BASE_URL } from '../../services/api';

export default function ProfileScreen({ navigation, onLogout }) {
  const [user,      setUser]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Profile load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', {
        uri:  result.assets[0].uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });
      await axios.post(`${BASE_URL}/api/auth/avatar`, formData, {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 20000,
      });
      Alert.alert('Updated!', 'Profile photo saved.');
      fetchProfile();
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'user']);
          if (onLogout) onLogout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#1B6B35" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!user) return null;

  const trustScore  = parseFloat(user.trust_score || 0);
  const reviewCount = parseInt(user.review_count || 0);
  const completedTx = parseInt(user.completed_transactions || 0);

  const getBadge = (score) => {
    if (reviewCount < 3) return { label: 'New',      color: '#43A047', bg: '#E8F5E9' };
    if (score >= 4.5)    return { label: 'Platinum',  color: '#3949AB', bg: '#E8EAF6' };
    if (score >= 4.0)    return { label: 'Gold',      color: '#F9A825', bg: '#FFF8E1' };
    if (score >= 3.0)    return { label: 'Silver',    color: '#757575', bg: '#F5F5F5' };
    return                      { label: 'Bronze',    color: '#BF360C', bg: '#FBE9E7' };
  };

  const badge     = getBadge(trustScore);
  const avatarUri = `${BASE_URL}/api/images/avatar/${user.id}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* Header banner */}
        <View style={styles.headerBanner}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={changeAvatar} disabled={uploading}>
            {uploading ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="#1B6B35" />
              </View>
            ) : (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                defaultSource={require('../../assets/icon.png')}
              />
            )}
            <View style={styles.cameraBtn}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userPhone}>📞 {user.phone}</Text>

          <View style={[styles.trustBadge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
            <Text style={[styles.trustScore, { color: badge.color }]}>
              ⭐ {trustScore.toFixed(1)}
            </Text>
            <Text style={[styles.trustLabel, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{completedTx}</Text>
            <Text style={styles.statLabel}>Deals Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{trustScore.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Trust Score</Text>
          </View>
        </View>

        {/* ── SELL / LIST SECTION ─────────────────────────────── */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>➕ Add New Listing</Text>

          {/* List a Crop */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('AddCrop')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.actionEmoji}>🌾</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>List a Crop</Text>
              <Text style={styles.actionSub}>Sell wheat, rice, vegetables & more</Text>
            </View>
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeTxt}>Sell</Text>
            </View>
          </TouchableOpacity>

          {/* List Land / Warehouse */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('AddListing')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.actionEmoji}>🏡</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>List Land / Warehouse</Text>
              <Text style={styles.actionSub}>Rent out your land or storage space</Text>
            </View>
            <View style={[styles.actionBadge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.actionBadgeTxt, { color: '#1565C0' }]}>Rent</Text>
            </View>
          </TouchableOpacity>

          {/* List a Service */}
          <TouchableOpacity
            style={[styles.actionRow, styles.lastRow]}
            onPress={() => navigation.navigate('AddService')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.actionEmoji}>🚜</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>List a Service / Tool</Text>
              <Text style={styles.actionSub}>Rotavator, transport, labor & more</Text>
            </View>
            <View style={[styles.actionBadge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.actionBadgeTxt, { color: '#E65100' }]}>Service</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── MY LISTINGS SECTION ─────────────────────────────── */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>📋 My Listings</Text>

          {[
            { icon: '🌾', label: 'My Crop Listings',   sub: 'View & manage your crops',         screen: 'Crops',    color: '#E8F5E9' },
            { icon: '🏡', label: 'My Rental Listings',  sub: 'View & manage your rentals',       screen: 'Listings', color: '#E3F2FD' },
            { icon: '🚜', label: 'My Services',          sub: 'View & manage your services',     screen: 'Services', color: '#FFF3E0' },
          ].map(({ icon, label, sub, screen, color }, idx, arr) => (
            <TouchableOpacity
              key={label}
              style={[styles.menuRow, idx === arr.length - 1 && styles.lastRow]}
              onPress={() => navigation.navigate(screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: color }]}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{label}</Text>
                <Text style={styles.menuSub}>{sub}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Address */}
        {user.address ? (
          <View style={styles.infoCard}>
            <Text style={styles.menuSection}>📍 Address</Text>
            <Text style={styles.infoTxt}>{user.address}</Text>
          </View>
        ) : null}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutTxt}>🚪  Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>AgriApp v1.0.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#F7F9F7' },
  container:      { paddingBottom: 40 },

  headerBanner:   {
    height: 100, backgroundColor: '#1B6B35',
    justifyContent: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 50,
  },
  headerTitle:    { fontSize: 24, fontWeight: '800', color: '#fff' },

  profileCard:    {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 20, padding: 20, alignItems: 'center',
    marginTop: -40,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  avatarWrap:     { position: 'relative', marginBottom: 12 },
  avatar:         {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#E8F5E9',
    borderWidth: 3, borderColor: '#1B6B35',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraBtn:      {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1B6B35',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  userName:       { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  userPhone:      { fontSize: 13, color: '#888', marginBottom: 12 },
  trustBadge:     {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  trustScore:     { fontSize: 16, fontWeight: '800' },
  trustLabel:     { fontSize: 12, fontWeight: '600' },

  statsRow:       {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  statBox:        { flex: 1, alignItems: 'center' },
  statNum:        { fontSize: 22, fontWeight: '800', color: '#1B6B35' },
  statLabel:      { fontSize: 11, color: '#888', marginTop: 2 },
  statDivider:    { width: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },

  menuCard:       {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  menuSection:    {
    fontSize: 13, fontWeight: '700', color: '#555',
    marginBottom: 12,
  },

  // Action rows (Add new listing)
  actionRow:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  actionIcon:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionEmoji:    { fontSize: 22 },
  actionInfo:     { flex: 1 },
  actionTitle:    { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  actionSub:      { fontSize: 11, color: '#888', marginTop: 2 },
  actionBadge:    {
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  actionBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#1B6B35' },

  // My listings rows
  menuRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  lastRow:        { borderBottomWidth: 0 },
  menuIcon:       { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel:      { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  menuSub:        { fontSize: 11, color: '#888', marginTop: 1 },
  menuArrow:      { fontSize: 22, color: '#ccc' },

  infoCard:       {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  infoTxt:        { fontSize: 14, color: '#555' },

  logoutBtn:      {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  logoutTxt:      { color: '#C62828', fontWeight: '700', fontSize: 15 },
  version:        { textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 16 },
});
