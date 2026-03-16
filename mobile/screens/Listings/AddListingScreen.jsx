// mobile/screens/Listings/AddListingScreen.jsx
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

const TYPES      = ['land', 'warehouse', 'coldStorage'];
const TYPE_LABEL = { land: 'Land', warehouse: 'Warehouse', coldStorage: 'Cold Storage' };
const AREA_UNITS = ['acres', 'sqft', 'sqm'];
const RENT_PER   = ['day', 'month', 'season', 'year'];

const DEFAULT_COORDS  = { lat: 30.7659, lng: 76.6584 };
const DEFAULT_ADDRESS = 'Jhanjeri, Mohali, Punjab 140307';

export default function AddListingScreen({ navigation }) {
  const [form, setForm] = useState({
    type: 'land', title: '', area: '', area_unit: 'acres',
    rent: '', rent_per: 'month', description: '',
    address: DEFAULT_ADDRESS, min_duration: '1',
  });
  const [coords,       setCoords]       = useState(DEFAULT_COORDS);
  const [saving,       setSaving]       = useState(false);
  const [locLoad,      setLocLoad]      = useState(false);
  const [usingDefault, setUsingDefault] = useState(true);

  const { images, pickFromCamera, pickFromGallery, removeImage } = useImageUpload(5);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { tryAutoLocation(); }, []);

  const tryAutoLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
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
    } catch (_) {}
  };

  const getLocation = async () => {
    setLocLoad(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS Denied', 'Using default location: Jhanjeri, Mohali.');
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
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
    } catch (_) {
      Alert.alert('GPS Unavailable', 'Using default: Jhanjeri, Mohali, Punjab.');
    } finally { setLocLoad(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Title is required.');
    if (!form.area.trim())  return Alert.alert('Required', 'Area is required.');
    if (!form.rent.trim())  return Alert.alert('Required', 'Rent is required.');

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('type',         form.type);
      formData.append('title',        form.title.trim());
      formData.append('area',         form.area);
      formData.append('area_unit',    form.area_unit);
      formData.append('rent',         form.rent);
      formData.append('rent_per',     form.rent_per);
      formData.append('description',  form.description);
      formData.append('address',      form.address);
      formData.append('min_duration', form.min_duration);
      formData.append('lat',          String(coords.lat));
      formData.append('lng',          String(coords.lng));
      formData.append('amenities',    JSON.stringify([]));

      images.forEach((img, i) => {
        formData.append('images', { uri: img.uri, name: `listing_img_${i}.jpg`, type: 'image/jpeg' });
      });

      await axios.post(`${BASE_URL}/api/listings`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      Alert.alert('Listed! 🏡', 'Your rental listing is now live.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save. Try again.');
    } finally { setSaving(false); }
  };

  const OptionList = ({ options, selected, onSelect, labelMap }) => (
    <View style={styles.optionList}>
      {options.map((opt, idx) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.optionRow,
            selected === opt && styles.optionRowActive,
            idx === options.length - 1 && styles.optionRowLast,
          ]}
          onPress={() => onSelect(opt)}
        >
          <View style={[styles.radio, selected === opt && styles.radioActive]} />
          <Text style={[styles.optionTxt, selected === opt && styles.optionTxtActive]}>
            {labelMap ? labelMap[opt] : opt.charAt(0).toUpperCase() + opt.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Photos */}
        <View style={styles.section}>
          <ImagePickerGrid
            images={images} onCamera={pickFromCamera}
            onGallery={pickFromGallery} onRemove={removeImage}
            maxImages={5} label="Listing Photos (up to 5)" uploading={saving}
          />
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Listing Details</Text>

          <Text style={styles.label}>Type *</Text>
          <OptionList
            options={TYPES} selected={form.type}
            onSelect={v => update('type', v)} labelMap={TYPE_LABEL}
          />

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5 Acre Irrigated Land Near Ludhiana"
            placeholderTextColor="#bbb"
            value={form.title} onChangeText={v => update('title', v)}
          />

          <Text style={styles.label}>Area *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5"
            placeholderTextColor="#bbb"
            value={form.area} onChangeText={v => update('area', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Area Unit *</Text>
          <OptionList
            options={AREA_UNITS} selected={form.area_unit}
            onSelect={v => update('area_unit', v)}
          />

          <Text style={styles.label}>Rent (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5000"
            placeholderTextColor="#bbb"
            value={form.rent} onChangeText={v => update('rent', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Rent Per *</Text>
          <OptionList
            options={RENT_PER} selected={form.rent_per}
            onSelect={v => update('rent_per', v)}
          />

          <Text style={styles.label}>Min. Duration (months)</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor="#bbb"
            value={form.min_duration} onChangeText={v => update('min_duration', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Water supply, soil type, road access, electricity..."
            placeholderTextColor="#bbb"
            value={form.description} onChangeText={v => update('description', v)}
            multiline numberOfLines={4} textAlignVertical="top"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          {usingDefault && (
            <View style={styles.defaultNotice}>
              <Text style={styles.defaultNoticeTxt}>📍 Using default: Jhanjeri, Mohali, Punjab 140307</Text>
              <Text style={styles.defaultNoticeHint}>Tap below to use your real GPS location</Text>
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
            value={form.address} onChangeText={v => update('address', v)}
          />
          <Text style={styles.coordTxt}>
            {usingDefault ? '📍 Default' : '✅ GPS'}: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnOff]}
          onPress={handleSave} disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Publish Rental Listing</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#F7F9F7' },
  container:         { padding: 16, paddingBottom: 40 },
  section:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eaeaea' },
  sectionTitle:      { fontSize: 16, fontWeight: '700', color: '#1B6B35', marginBottom: 12 },
  label:             { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 14 },
  input:             { backgroundColor: '#F8F9F8', borderRadius: 12, padding: 13, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0', color: '#222' },
  multiline:         { height: 90, paddingTop: 10 },
  optionList:        { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden' },
  optionRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#F8F9F8', gap: 12, borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  optionRowActive:   { backgroundColor: '#E8F5E9' },
  optionRowLast:     { borderBottomWidth: 0 },
  radio:             { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc' },
  radioActive:       { borderColor: '#1B6B35', backgroundColor: '#1B6B35' },
  optionTxt:         { fontSize: 14, color: '#444' },
  optionTxtActive:   { color: '#1B6B35', fontWeight: '700' },
  defaultNotice:     { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#FFE082' },
  defaultNoticeTxt:  { fontSize: 13, color: '#8D6E00', fontWeight: '600' },
  defaultNoticeHint: { fontSize: 11, color: '#A07800', marginTop: 2 },
  locBtn:            { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#A5D6A7' },
  locBtnTxt:         { color: '#1B6B35', fontWeight: '700', fontSize: 14 },
  coordTxt:          { fontSize: 11, color: '#aaa', marginTop: 8 },
  saveBtn:           { backgroundColor: '#1B6B35', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnOff:        { backgroundColor: '#76a882' },
  saveBtnTxt:        { color: '#fff', fontSize: 16, fontWeight: '700' },
});
