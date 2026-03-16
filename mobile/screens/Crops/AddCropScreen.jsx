// mobile/screens/Crops/AddCropScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import useImageUpload from '../../hooks/useImageUpload';
import ImagePickerGrid from '../../components/ImagePickerGrid';
import { BASE_URL } from '../../services/api';

const CATEGORIES = ['grain', 'vegetable', 'fruit', 'legume', 'spice', 'other'];
const UNITS      = ['kg', 'quintal', 'ton', 'dozen', 'piece'];

// ── Default fallback — Jhanjeri, Mohali, Punjab 140307 ───────
const DEFAULT_COORDS  = { lat: 30.7659, lng: 76.6584 };
const DEFAULT_ADDRESS = 'Jhanjeri, Mohali, Punjab 140307';

export default function AddCropScreen({ navigation }) {
  const [form, setForm] = useState({
    name: '', category: 'grain', price: '', unit: 'kg',
    quantity: '', description: '', harvest_date: '',
    address: DEFAULT_ADDRESS,               // pre-filled with default
  });
  const [coords,  setCoords]  = useState(DEFAULT_COORDS);  // default from start
  const [saving,  setSaving]  = useState(false);
  const [locLoad, setLocLoad] = useState(false);
  const [usingDefault, setUsingDefault] = useState(true);  // show yellow notice

  const { images, pickFromCamera, pickFromGallery, removeImage } = useImageUpload(5);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Try to get real GPS on mount silently
  useEffect(() => {
    tryAutoLocation();
  }, []);

  const tryAutoLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return; // keep default silently

      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);

      const newCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(newCoords);
      setUsingDefault(false);

      // Try reverse geocode
      try {
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo.length > 0) {
          const g = geo[0];
          const addr = [g.street, g.city, g.region].filter(Boolean).join(', ');
          if (addr) update('address', addr);
        }
      } catch (_) {}

    } catch (_) {
      // GPS failed — keep default coords, no alert needed
    }
  };

  // Manual location refresh button
  const getLocation = async () => {
    setLocLoad(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'GPS Permission Denied',
          'Using default location: Jhanjeri, Mohali. You can type your address manually.',
        );
        return;
      }

      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 8000)),
      ]);

      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setUsingDefault(false);

      try {
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo.length > 0) {
          const g = geo[0];
          const addr = [g.street, g.city, g.region].filter(Boolean).join(', ');
          if (addr) update('address', addr);
        }
      } catch (_) {}

    } catch (err) {
      Alert.alert(
        'GPS Unavailable',
        'Using default location: Jhanjeri, Mohali, Punjab. You can type your address manually.',
      );
    } finally {
      setLocLoad(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim())     return Alert.alert('Required', 'Crop name is required.');
    if (!form.price.trim())    return Alert.alert('Required', 'Price is required.');
    if (!form.quantity.trim()) return Alert.alert('Required', 'Quantity is required.');
    // coords always has a value (default or GPS) — no GPS check needed

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('name',        form.name.trim());
      formData.append('category',    form.category);
      formData.append('price',       form.price);
      formData.append('unit',        form.unit);
      formData.append('quantity',    form.quantity);
      formData.append('description', form.description);
      formData.append('address',     form.address);
      formData.append('lat',         String(coords.lat));
      formData.append('lng',         String(coords.lng));
      if (form.harvest_date) formData.append('harvest_date', form.harvest_date);

      images.forEach((img, i) => {
        formData.append('images', {
          uri:  img.uri,
          name: `crop_image_${i}.jpg`,
          type: 'image/jpeg',
        });
      });

      await axios.post(`${BASE_URL}/api/crops`, formData, {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      Alert.alert('Success! 🎉', 'Your crop listing is now live.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Photos */}
        <View style={styles.section}>
          <ImagePickerGrid
            images={images} onCamera={pickFromCamera}
            onGallery={pickFromGallery} onRemove={removeImage}
            maxImages={5} label="Crop Photos (up to 5)" uploading={saving}
          />
        </View>

        {/* Crop Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crop Details</Text>

          <Text style={styles.label}>Crop Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Basmati Rice, Tomato"
            placeholderTextColor="#bbb"
            value={form.name}
            onChangeText={v => update('name', v)}
          />

          <Text style={styles.label}>Category *</Text>
          <View style={styles.optionList}>
            {CATEGORIES.map((c, idx) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.optionRow,
                  form.category === c && styles.optionRowActive,
                  idx === CATEGORIES.length - 1 && styles.optionRowLast,
                ]}
                onPress={() => update('category', c)}
              >
                <View style={[styles.radio, form.category === c && styles.radioActive]} />
                <Text style={[styles.optionTxt, form.category === c && styles.optionTxtActive]}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Price (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2000"
            placeholderTextColor="#bbb"
            value={form.price}
            onChangeText={v => update('price', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Unit *</Text>
          <View style={styles.optionList}>
            {UNITS.map((u, idx) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.optionRow,
                  form.unit === u && styles.optionRowActive,
                  idx === UNITS.length - 1 && styles.optionRowLast,
                ]}
                onPress={() => update('unit', u)}
              >
                <View style={[styles.radio, form.unit === u && styles.radioActive]} />
                <Text style={[styles.optionTxt, form.unit === u && styles.optionTxtActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500"
            placeholderTextColor="#bbb"
            value={form.quantity}
            onChangeText={v => update('quantity', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Quality, variety, storage info..."
            placeholderTextColor="#bbb"
            value={form.description}
            onChangeText={v => update('description', v)}
            multiline numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Harvest Date (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#bbb"
            value={form.harvest_date}
            onChangeText={v => update('harvest_date', v)}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          {/* Default location notice */}
          {usingDefault && (
            <View style={styles.defaultNotice}>
              <Text style={styles.defaultNoticeTxt}>
                📍 Using default: Jhanjeri, Mohali, Punjab 140307
              </Text>
              <Text style={styles.defaultNoticeHint}>
                Tap the button below to use your real GPS location
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.locBtn} onPress={getLocation}>
            {locLoad
              ? <ActivityIndicator color="#1B6B35" size="small" />
              : <Text style={styles.locBtnTxt}>
                  {usingDefault ? '📍  Get My Real Location' : '📍  Update Location'}
                </Text>
            }
          </TouchableOpacity>

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Address"
            placeholderTextColor="#bbb"
            value={form.address}
            onChangeText={v => update('address', v)}
          />

          <Text style={styles.coordTxt}>
            {usingDefault ? '📍 Default' : '✅ GPS'}: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnTxt}>Publish Crop Listing</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F7F9F7' },
  container:        { padding: 16, paddingBottom: 40 },
  section:          {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#eaeaea',
  },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: '#1B6B35', marginBottom: 12 },
  label:            { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 14 },
  input:            {
    backgroundColor: '#F8F9F8', borderRadius: 12, padding: 13,
    fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0', color: '#222',
  },
  multiline:        { height: 80, paddingTop: 10 },
  optionList:       { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden' },
  optionRow:        {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: '#F8F9F8', gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  optionRowActive:  { backgroundColor: '#E8F5E9' },
  optionRowLast:    { borderBottomWidth: 0 },
  radio:            { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc' },
  radioActive:      { borderColor: '#1B6B35', backgroundColor: '#1B6B35' },
  optionTxt:        { fontSize: 14, color: '#444' },
  optionTxtActive:  { color: '#1B6B35', fontWeight: '700' },
  defaultNotice:    {
    backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#FFE082',
  },
  defaultNoticeTxt: { fontSize: 13, color: '#8D6E00', fontWeight: '600' },
  defaultNoticeHint:{ fontSize: 11, color: '#A07800', marginTop: 2 },
  locBtn:           {
    backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#A5D6A7',
  },
  locBtnTxt:        { color: '#1B6B35', fontWeight: '700', fontSize: 14 },
  coordTxt:         { fontSize: 11, color: '#aaa', marginTop: 8 },
  saveBtn:          {
    backgroundColor: '#1B6B35', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnOff:       { backgroundColor: '#76a882' },
  saveBtnTxt:       { color: '#fff', fontSize: 16, fontWeight: '700' },
});
