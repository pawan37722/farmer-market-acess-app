// mobile/screens/Crops/CropDetailScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
  FlatList, Dimensions,
} from 'react-native';
import api, { BASE_URL } from '../../services/api';
import TrustBadge from '../../components/TrustBadge';

const { width } = Dimensions.get('window');

export default function CropDetailScreen({ route, navigation }) {
  const { cropId } = route.params;
  const [crop,    setCrop]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx,  setImgIdx]  = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/crops/${cropId}`);
        setCrop(data.crop);
      } catch (err) {
        Alert.alert('Error', 'Could not load crop details.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [cropId]);

  const handleContact = async () => {
    if (!crop) return;
    try {
      await api.post('/transactions', {
        seller_id: crop.farmer_id,
        item_id:   crop.id,
        item_type: 'crop',
        quantity:  1,
        amount:    parseFloat(crop.price),
        notes:     'Interested in this crop',
      });
      Alert.alert('Request sent! 🎉', 'The farmer has been notified. Check My Transactions for updates.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send request.');
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator size="large" color="#1B6B35" style={{ marginTop: 80 }} />
    </SafeAreaView>
  );

  if (!crop) return null;

  const images = crop.images || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        {/* Image carousel */}
        {images.length > 0 ? (
          <View>
            <FlatList
              data={images}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              onMomentumScrollEnd={e => {
                setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width));
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: `${BASE_URL}/api/images/crop/${item.id}` }}
                  style={{ width, height: 260 }}
                  resizeMode="cover"
                />
              )}
            />
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noImgBox}>
            <Text style={{ fontSize: 56 }}>🌾</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title & price */}
          <View style={styles.titleRow}>
            <Text style={styles.cropName}>{crop.name}</Text>
            <Text style={styles.price}>₹{crop.price}/{crop.unit}</Text>
          </View>
          <Text style={styles.meta}>
            {crop.category?.toUpperCase()} · {crop.quantity} {crop.unit} available
          </Text>

          {/* Farmer card */}
          <View style={styles.farmerCard}>
            <Image
              source={crop.farmer_id
                ? { uri: `${BASE_URL}/api/images/avatar/${crop.farmer_id}` }
                : require('../../assets/icon.png')
              }
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.farmerName}>{crop.farmer_name}</Text>
              <Text style={styles.farmerSub}>
                {crop.completed_transactions || 0} deals · {crop.review_count || 0} reviews
              </Text>
            </View>
            <TrustBadge score={crop.trust_score || 0} badge="New" size="lg" />
          </View>

          {/* Details */}
          {crop.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this crop</Text>
              <Text style={styles.desc}>{crop.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {crop.harvest_date && (
              <Text style={styles.detailRow}>🗓 Harvest date: {crop.harvest_date?.slice(0, 10)}</Text>
            )}
            {crop.address && (
              <Text style={styles.detailRow}>📍 {crop.address}</Text>
            )}
            <Text style={styles.detailRow}>👁 {crop.views || 0} views</Text>
          </View>
        </View>
      </ScrollView>

      {/* Contact CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity style={styles.ctaBtn} onPress={handleContact}>
          <Text style={styles.ctaBtnTxt}>Contact Farmer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  noImgBox:    { height: 200, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -20, marginBottom: 8 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:   { backgroundColor: '#fff', width: 14 },
  body:        { padding: 16, paddingBottom: 100 },
  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cropName:    { fontSize: 22, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  price:       { fontSize: 20, fontWeight: '700', color: '#1B6B35' },
  meta:        { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 16 },
  farmerCard:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8faf8', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16,
  },
  avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0e0e0' },
  farmerName:  { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  farmerSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1B6B35', marginBottom: 8 },
  desc:        { fontSize: 14, color: '#444', lineHeight: 22 },
  detailRow:   { fontSize: 14, color: '#555', marginBottom: 6 },
  ctaBar:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  ctaBtn:      {
    backgroundColor: '#1B6B35', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  ctaBtnTxt:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});
