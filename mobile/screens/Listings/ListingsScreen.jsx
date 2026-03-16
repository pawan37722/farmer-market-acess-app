// mobile/screens/Listings/ListingsScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, ActivityIndicator, ScrollView,
} from 'react-native';
import api, { BASE_URL } from '../../services/api';
import useLocation from '../../hooks/useLocation';

const TYPES    = ['All', 'Land', 'Warehouse', 'Cold Storage'];
const TYPE_MAP = { 'Land': 'land', 'Warehouse': 'warehouse', 'Cold Storage': 'coldStorage' };

export default function ListingsScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [type,     setType]     = useState('All');

  const { location, isDefaultLocation } = useLocation();

  useEffect(() => { fetchListings(); }, [type, location]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/listings', {
        params: {
          ...(type !== 'All' && { type: TYPE_MAP[type] }),
          ...(location && { lat: location.latitude, lng: location.longitude, radius: 80 }),
        },
      });
      setListings(data.listings || []);
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const renderCard = ({ item }) => {
    const imgUri = item.thumbnail_image_id
      ? `${BASE_URL}/api/images/listing/${item.thumbnail_image_id}`
      : null;
    return (
      <View style={styles.card}>
        {imgUri
          ? <Image source={{ uri: imgUri }} style={styles.cardImg} />
          : <View style={[styles.cardImg, styles.noImg]}><Text style={{ fontSize: 30 }}>🏡</Text></View>
        }
        <View style={styles.cardBody}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.meta}>{item.type?.toUpperCase()} · {item.area} {item.area_unit}</Text>
          <Text style={styles.rent}>₹{item.rent} / {item.rent_per}</Text>
          <Text style={styles.owner}>👤 {item.owner_name}</Text>
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
        <Text style={styles.title}>Rentals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddListing')}>
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
        {TYPES.map(t => (
          <TouchableOpacity key={t}
            style={[styles.chip, type === t && styles.chipActive]}
            onPress={() => setType(t)}>
            <Text style={[styles.chipTxt, type === t && styles.chipTxtA]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator color="#1B6B35" size="large" style={{ marginTop: 60 }} />
        : <FlatList
            data={listings} keyExtractor={i => i.id} renderItem={renderCard}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 48 }}>🏡</Text>
                <Text style={styles.emptyTxt}>No rentals found nearby.</Text>
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
  cardImg:          { width: 90, height: 100 },
  noImg:            { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cardBody:         { flex: 1, padding: 10 },
  listingTitle:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  meta:             { fontSize: 11, color: '#888', marginTop: 2 },
  rent:             { fontSize: 14, fontWeight: '700', color: '#1B6B35', marginTop: 2 },
  owner:            { fontSize: 12, color: '#555', marginTop: 4 },
  dist:             { fontSize: 11, color: '#aaa', marginTop: 2 },
  empty:            { alignItems: 'center', marginTop: 80 },
  emptyTxt:         { fontSize: 16, color: '#888', marginTop: 12 },
});
