// mobile/hooks/useImageUpload.js
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

// ── useImageUpload ────────────────────────────────────────────
// Manages local image selection state before submission.
// Images are NOT uploaded standalone — they are sent as
// multipart/form-data fields when the form is submitted
// (POST /api/crops or POST /api/services).
//
// Returns:
//   images          - array of { uri, name, type }
//   pickFromGallery - open photo library (multi-select)
//   pickFromCamera  - open camera (single)
//   removeImage     - remove by index
//   clearImages     - clear all
//   isAtLimit       - boolean

export default function useImageUpload(maxImages = 5) {
  const [images, setImages] = useState([]);

  // ── Permissions ───────────────────────────────────────────
  const requestCameraPermission = async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed.');
      return false;
    }
    return true;
  };

  // ── Core handler ──────────────────────────────────────────
  const handleResult = useCallback((result) => {
    if (result.canceled || !result.assets?.length) return;

    const remaining = maxImages - images.length;
    const selected  = result.assets.slice(0, remaining);

    const newImages = selected.map((asset, i) => ({
      uri:  asset.uri,
      name: `image_${Date.now()}_${i}.jpg`,
      type: 'image/jpeg',
    }));

    setImages(prev => [...prev, ...newImages]);
  }, [images, maxImages]);

  // ── Open camera ───────────────────────────────────────────
  const pickFromCamera = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit reached', `Maximum ${maxImages} photos allowed.`);
      return;
    }
    const ok = await requestCameraPermission();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.85,
      allowsEditing: true,
      aspect:     [4, 3],
    });
    handleResult(result);
  }, [images, maxImages, handleResult]);

  // ── Open gallery (multi-select) ───────────────────────────
  const pickFromGallery = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit reached', `Maximum ${maxImages} photos allowed.`);
      return;
    }
    const ok = await requestGalleryPermission();
    if (!ok) return;

    const remaining = maxImages - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:             ImagePicker.MediaTypeOptions.Images,
      quality:                0.85,
      allowsMultipleSelection: true,
      selectionLimit:         remaining,
    });
    handleResult(result);
  }, [images, maxImages, handleResult]);

  const removeImage  = useCallback((index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages  = useCallback(() => setImages([]), []);

  // Build FormData entries for axios multipart upload
  const getFormDataEntries = useCallback(() => images, [images]);

  return {
    images,
    pickFromCamera,
    pickFromGallery,
    removeImage,
    clearImages,
    isAtLimit: images.length >= maxImages,
    getFormDataEntries,
  };
}
