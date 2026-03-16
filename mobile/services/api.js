// mobile/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Base URL ──────────────────────────────────────────────────
// Android emulator  → 10.0.2.2 maps to your PC's localhost
// iOS simulator     → localhost works
// Physical device   → replace with your LAN IP, e.g. 192.168.1.10
export const BASE_URL = __DEV__
  ? 'http://10.0.2.2:5000'
  : 'https://your-production-api.com';

// ── Axios instance ────────────────────────────────────────────
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach JWT on every request ───────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto logout on 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    return Promise.reject(error);
  }
);

// ── Image URL helper ──────────────────────────────────────────
// Images are served from the backend as binary (stored in PostgreSQL BYTEA).
// Pass the image id and type to get the full URL.
export const getImageUrl = (type, id) => {
  if (!id) return null;
  // type: 'crop' | 'service' | 'listing' | 'avatar'
  return `${BASE_URL}/api/images/${type}/${id}`;
};

// ── Upload helper (multipart/form-data) ──────────────────────
// Used for uploading images from the React Native image picker.
// Returns the processed image metadata array from the server.
export const uploadImages = async (imageUris, type = 'service') => {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  imageUris.forEach((uri, i) => {
    formData.append('images', {
      uri,
      name: `${type}_image_${Date.now()}_${i}.jpg`,
      type: 'image/jpeg',
    });
  });

  const response = await axios.post(
    `${BASE_URL}/api/${type}s`,  // POST /api/crops  or  /api/services
    formData,
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    }
  );
  return response.data;
};

export default api;
