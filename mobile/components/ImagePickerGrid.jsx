// mobile/components/ImagePickerGrid.jsx
import React from 'react';
import {
  View, Image, TouchableOpacity, Text,
  StyleSheet, ActivityIndicator,
} from 'react-native';

// ── ImagePickerGrid ───────────────────────────────────────────
// Props:
//   images        - array of { uri, name, type } from useImageUpload
//   onCamera      - open camera
//   onGallery     - open gallery
//   onRemove      - (index) => void
//   maxImages     - default 5
//   label         - section label string
//   uploading     - bool — show spinner overlay on all thumbs

export default function ImagePickerGrid({
  images = [],
  onCamera,
  onGallery,
  onRemove,
  maxImages = 5,
  label = 'Photos',
  uploading = false,
}) {
  const canAdd = images.length < maxImages;

  return (
    <View style={styles.wrapper}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.counter}>{images.length} / {maxImages}</Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>

        {/* Thumbnails */}
        {images.map((img, index) => (
          <View key={`${img.uri}-${index}`} style={styles.thumbBox}>
            <Image source={{ uri: img.uri }} style={styles.thumb} />

            {/* Upload spinner overlay */}
            {uploading && (
              <View style={styles.overlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}

            {/* Remove button */}
            {!uploading && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeTxt}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Camera add button */}
        {canAdd && (
          <TouchableOpacity style={[styles.addBtn, styles.cameraBtn]} onPress={onCamera}>
            <Text style={styles.addIcon}>📷</Text>
            <Text style={styles.addLabel}>Camera</Text>
          </TouchableOpacity>
        )}

        {/* Gallery add button */}
        {canAdd && (
          <TouchableOpacity style={[styles.addBtn, styles.galleryBtn]} onPress={onGallery}>
            <Text style={styles.addIcon}>🖼️</Text>
            <Text style={styles.addLabel}>Gallery</Text>
          </TouchableOpacity>
        )}
      </View>

      {images.length === 0 && (
        <Text style={styles.hint}>Tap Camera or Gallery to add photos.</Text>
      )}
    </View>
  );
}

const SIZE = 88;

const styles = StyleSheet.create({
  wrapper:    { marginBottom: 8 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label:      { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  counter:    { fontSize: 13, color: '#888' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbBox:   { width: SIZE, height: SIZE, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb:      { width: SIZE, height: SIZE, backgroundColor: '#e0e0e0' },
  overlay:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtn:  {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  removeTxt:  { color: '#fff', fontSize: 11, fontWeight: '900', lineHeight: 20 },
  addBtn:     {
    width: SIZE, height: SIZE, borderRadius: 10,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraBtn:  { borderColor: '#2d7a45', backgroundColor: '#f0faf4' },
  galleryBtn: { borderColor: '#1565c0', backgroundColor: '#e3f2fd' },
  addIcon:    { fontSize: 22 },
  addLabel:   { fontSize: 11, marginTop: 2, color: '#555', fontWeight: '600' },
  hint:       { fontSize: 12, color: '#aaa', marginTop: 6 },
});
