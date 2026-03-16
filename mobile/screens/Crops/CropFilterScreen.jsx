// mobile/screens/Crops/CropFilterScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView,
  Image, ScrollView, RefreshControl, StatusBar, Dimensions,
} from 'react-native';
import { BASE_URL } from '../../services/api';
import api from '../../services/api';
import useLocation from '../../hooks/useLocation';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORIES = [
  { label: 'All',       emoji: '🌿' },
  { label: 'Grain',     emoji: '🌾' },
  { label: 'Vegetable', emoji: '🥦' },
  { label: 'Fruit',     emoji: '🍎' },
  { label: 'Legume',    emoji: '🫘' },
  { label: 'Spice',     emoji: '🌶️' },
  { label: 'Other',     emoji: '🌱' },
];

const BANNERS = [
  { bg: '#1B6B35', title: 'Fresh from\nthe Farm',    sub: 'Buy directly from farmers',      emoji: '🌾' },
  { bg: '#2E7D32', title: 'Rent Farm\nEquipment',    sub: 'Rotavators, tractors & more',    emoji: '🚜' },
  { bg: '#1565C0', title: 'List Your\nProduce',      sub: 'Reach thousands of buyers',      emoji: '📦' },
];

export default function CropFilterScreen({ navigation }) {
  const [crops,      setCrops]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('All');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [bannerIdx,  setBannerIdx]  = useState(0);
  const debounceRef = useRef(null);
  const bannerRef   = useRef(null);

  // ── Use shared location hook (falls back to Jhanjeri) ────
  const { location, isDefaultLocation } = useLocation();

  // Auto-scroll banner
  useEffect(() => {
    const timer = setInterval(() => {
      const next = (bannerIdx + 1) % BANNERS.length;
      setBannerIdx(next);
      bannerRef.current?.scrollTo({ x: next * (width - 32), animated: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [bannerIdx]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCrops([]); setPage(1); setHasMore(true);
      fetchCrops(1, true);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, category, location]);

  const fetchCrops = async (pageNum = 1, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.get('/crops', {
        params: {
          page: pageNum, limit: 20,
          ...(search && { search }),
          ...(category !== 'All' && { category: category.toLowerCase() }),
          ...(location && {
            lat:    location.latitude,
            lng:    location.longitude,
            radius: 50,
          }),
        },
      });
      setCrops(prev => reset ? data.crops : [...prev, ...data.crops]);
      setTotal(data.pagination?.total || 0);
      setHasMore(pageNum < (data.pagination?.pages || 1));
    } catch (err) {
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchCrops(next);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setCrops([]); setPage(1);
    fetchCrops(1, true);
  };

  const ListHeader = () => (
    <View>
      {/* Banner carousel */}
      <ScrollView
        ref={bannerRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (width - 32)));
        }}
        style={styles.bannerScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {BANNERS.map((b, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.banner, { backgroundColor: b.bg, width: width - 32 }]}
            activeOpacity={0.92}
          >
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>{b.title}</Text>
              <Text style={styles.bannerSub}>{b.sub}</Text>
              <View style={styles.bannerBtn}>
                <Text style={styles.bannerBtnTxt}>Explore →</Text>
              </View>
            </View>
            <Text style={styles.bannerEmoji}>{b.emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Banner dots */}
      <View style={styles.dotsRow}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === bannerIdx && styles.dotActive]} />
        ))}
      </View>

      {/* Section title */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {total > 0 ? `${total} Crops Available` : 'Fresh Crops'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddCrop')}>
          <Text style={styles.seeAll}>+ List Crop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCard = ({ item }) => {
    const imgUri = item.thumbnail_image_id
      ? `${BASE_URL}/api/images/crop/${item.thumbnail_image_id}`
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.93}
        onPress={() => navigation.navigate('CropDetail', { cropId: item.id })}
      >
        <View style={styles.imgBox}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.cardImg} resizeMode="cover" />
          ) : (
            <View style={styles.imgPlaceholder}>
              <Text style={{ fontSize: 34 }}>🌾</Text>
            </View>
          )}
          <TouchableOpacity style={styles.wishBtn}>
            <Text style={{ fontSize: 13 }}>🤍</Text>
          </TouchableOpacity>
          <View style={styles.catTag}>
            <Text style={styles.catTagTxt}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cropName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingTxt}>⭐ {parseFloat(item.farmer_trust || 0).toFixed(1)}</Text>
            <Text style={styles.dotSep}>·</Text>
            <Text style={styles.farmerTxt} numberOfLines={1}>{item.farmer_name}</Text>
          </View>
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.price}>
                ₹{item.price}<Text style={styles.priceUnit}>/{item.unit}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('CropDetail', { cropId: item.id })}
            >
              <Text style={styles.addBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
          {item.distance_km != null && (
            <Text style={styles.distTxt}>📍 {item.distance_km} km away</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9F7" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.locationRow}>
          <Text style={styles.locationPin}>📍</Text>
          <View>
            <Text style={styles.locationLabel}>
              {isDefaultLocation ? 'Default location' : 'Near you'}
            </Text>
            <Text style={styles.locationName} numberOfLines={1}>
              {location?.address || 'Jhanjeri, Mohali, Punjab'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchEmoji}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search crops, vegetables, fruits..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.chip, category === cat.label && styles.chipActive]}
            onPress={() => setCategory(cat.label)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipEmoji}>{cat.emoji}</Text>
            <Text style={[styles.chipTxt, category === cat.label && styles.chipTxtActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Default location notice */}
      {isDefaultLocation && (
        <View style={styles.defaultLocBanner}>
          <Text style={styles.defaultLocTxt}>
            📍 Showing results near Jhanjeri, Mohali — enable GPS for your exact location
          </Text>
        </View>
      )}

      {/* List */}
      {loading && crops.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#1B6B35" size="large" />
          <Text style={styles.loadingTxt}>Finding fresh crops near you...</Text>
        </View>
      ) : (
        <FlatList
          data={crops}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.colWrap}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<ListHeader />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            hasMore && loading
              ? <ActivityIndicator color="#1B6B35" style={{ marginVertical: 20 }} />
              : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>No crops found</Text>
                <Text style={styles.emptySub}>Be the first to list a crop in your area!</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddCrop')}>
                  <Text style={styles.emptyBtnTxt}>+ List Your Crop</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor="#1B6B35" colors={['#1B6B35']} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#F7F9F7' },
  topBar:         {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 8,
  },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  locationPin:    { fontSize: 16 },
  locationLabel:  { fontSize: 11, color: '#888' },
  locationName:   { fontSize: 13, fontWeight: '700', color: '#1a1a1a', maxWidth: width * 0.55 },
  notifBtn:       {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#E8EDE8',
  },
  searchWrap:     {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E8EDE8',
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  searchEmoji:    { fontSize: 14, marginRight: 8 },
  searchInput:    { flex: 1, fontSize: 14, paddingVertical: 11, color: '#222' },
  clearBtn:       { padding: 6 },
  clearTxt:       { fontSize: 12, color: '#aaa' },
  chipRow:        { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  chip:           {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#DDE8DD', backgroundColor: '#fff',
  },
  chipActive:     { backgroundColor: '#1B6B35', borderColor: '#1B6B35' },
  chipEmoji:      { fontSize: 13 },
  chipTxt:        { fontSize: 12, color: '#555', fontWeight: '600' },
  chipTxtActive:  { color: '#fff' },

  // Default location notice
  defaultLocBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#FFF8E1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FFE082',
  },
  defaultLocTxt:  { fontSize: 11, color: '#8D6E00' },

  bannerScroll:   { marginBottom: 4 },
  banner:         {
    height: 140, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, overflow: 'hidden',
  },
  bannerLeft:     { flex: 1 },
  bannerTitle:    { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26, marginBottom: 4 },
  bannerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  bannerBtn:      {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
  },
  bannerBtnTxt:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerEmoji:    { fontSize: 56, marginLeft: 8 },
  dotsRow:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16, marginTop: 8 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C8DFC8' },
  dotActive:      { width: 18, backgroundColor: '#1B6B35' },
  sectionRow:     {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle:   { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  seeAll:         { fontSize: 13, color: '#1B6B35', fontWeight: '700' },
  colWrap:        { justifyContent: 'space-between', paddingHorizontal: 16 },
  listContent:    { paddingBottom: 100 },
  card:           {
    width: CARD_WIDTH, backgroundColor: '#fff',
    borderRadius: 18, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4,
  },
  imgBox:         { position: 'relative' },
  cardImg:        { width: '100%', height: 130 },
  imgPlaceholder: { width: '100%', height: 130, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  wishBtn:        {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  catTag:         {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(27,107,53,0.85)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  catTagTxt:      { color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  cardBody:       { padding: 10 },
  cropName:       { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingTxt:      { fontSize: 11, color: '#888', fontWeight: '600' },
  dotSep:         { fontSize: 11, color: '#ccc', marginHorizontal: 4 },
  farmerTxt:      { fontSize: 11, color: '#888', flex: 1 },
  bottomRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  priceLabel:     { fontSize: 10, color: '#aaa' },
  price:          { fontSize: 15, fontWeight: '800', color: '#1B6B35' },
  priceUnit:      { fontSize: 10, color: '#aaa', fontWeight: '400' },
  addBtn:         {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1B6B35', justifyContent: 'center', alignItems: 'center',
  },
  addBtnTxt:      { color: '#fff', fontSize: 20, fontWeight: '300', lineHeight: 28 },
  distTxt:        { fontSize: 10, color: '#bbb', marginTop: 5 },
  loadingWrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  loadingTxt:     { fontSize: 13, color: '#888', marginTop: 12 },
  empty:          { alignItems: 'center', paddingTop: 20, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 60, marginBottom: 12 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  emptySub:       { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:       { backgroundColor: '#1B6B35', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
});
