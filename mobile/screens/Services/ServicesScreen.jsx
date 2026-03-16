// mobile/screens/Services/ServicesScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, ActivityIndicator, ScrollView,
} from 'react-native';
import api, { BASE_URL } from '../../services/api';
import TrustBadge from '../../components/TrustBadge';
import useLocation from '../../hooks/useLocation';

const CATS = ['All', 'Equipment', 'Transport', 'Labor', 'Irrigation', 'Other'];

export default function ServicesScreen({ navigation }) {
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState('All');

  const { location, isDefaultLocation } = useLocation();

  useEffect(() => { fetchServices(); }, [category, location]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/services', {
        params: {
          ...(category !== 'All' && { category: category.toLowerCase() }),
          ...(location && { lat: location.latitude, lng: location.longitude, radius: 100 }),
        },
      });
      setServices(data.services || []);
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const renderCard = ({ item }) => {
    const imgUri = item.thumbnail_image_id
      ? `${BASE_URL}/api/images/service/${item.thumbnail_image_id}`
      : null;
    return (
      <View style={styles.card}>
        {imgUri
          ? <Image source={{ uri: imgUri }} style={styles.cardImg} />
          : <View style={[styles.cardImg, styles.noImg]}><Text style={{ fontSize: 30 }}>🚜</Text></View>
        }
        <View style={styles.cardBody}>
          <Text style={styles.svcName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.meta}>{item.category?.toUpperCase()}</Text>
          <Text style={styles.price}>₹{item.price} / {item.price_per}</Text>
          <View style={styles.provRow}>
            <Text style={styles.provName} numberOfLines={1}>👤 {item.provider_name}</Text>
            <TrustBadge score={item.trust_score || 0} badge="New" />
          </View>
          {item.distance_km != null && (
            <Text style={styles.dist}>📍 {item.distance_km} km away</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Services & Tools</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddService')}>
          <Text style={styles.addBtnTxt}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isDefaultLocation && (
        <View style={styles.defaultLocBanner}>
          <Text style={styles.defaultLocTxt}>
            📍 Showing results near Jhanjeri, Mohali — enable GPS for your location
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        {CATS.map(c => (
          <TouchableOpacity key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}>
            <Text style={[styles.chipTxt, category === c && styles.chipTxtA]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator color="#1B6B35" size="large" style={{ marginTop: 60 }} />
        : <FlatList
            data={services} keyExtractor={i => i.id} renderItem={renderCard}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 48 }}>🚜</Text>
                <Text style={styles.emptyTxt}>No services found nearby.</Text>
              </View>
            }
          />
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#f4f6f3' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title:            { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  addBtn:           { backgroundColor: '#1B6B35', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  addBtnTxt:        { color: '#fff', fontWeight: '700', fontSize: 13 },
  defaultLocBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFF8E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FFE082' },
  defaultLocTxt:    { fontSize: 11, color: '#8D6E00' },
  chipRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8, height: 44 }, 
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  chipActive:       { backgroundColor: '#1B6B35', borderColor: '#1B6B35' },
  chipTxt:          { fontSize: 12, color: '#555' },
  chipTxtA:         { color: '#fff' },
  list:             { paddingHorizontal: 12, paddingBottom: 24 },
  card:             { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eaeaea' },
  cardImg:          { width: 90, height: 110 },
  noImg:            { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cardBody:         { flex: 1, padding: 10 },
  svcName:          { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  meta:             { fontSize: 11, color: '#888', marginTop: 2 },
  price:            { fontSize: 14, fontWeight: '700', color: '#1B6B35', marginTop: 2 },
  provRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  provName:         { fontSize: 12, color: '#555', flex: 1 },
  dist:             { fontSize: 11, color: '#aaa', marginTop: 2 },
  empty:            { alignItems: 'center', marginTop: 80 },
  emptyTxt:         { fontSize: 16, color: '#888', marginTop: 12 },
});
