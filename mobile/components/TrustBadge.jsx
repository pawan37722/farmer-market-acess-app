// mobile/components/TrustBadge.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BADGE_STYLES = {
  Platinum: { bg: '#E8EAF6', border: '#3949AB', text: '#1A237E' },
  Gold:     { bg: '#FFF8E1', border: '#F9A825', text: '#7a5c00' },
  Silver:   { bg: '#F5F5F5', border: '#9E9E9E', text: '#424242' },
  Bronze:   { bg: '#FBE9E7', border: '#BF360C', text: '#7f2700' },
  New:      { bg: '#E8F5E9', border: '#43A047', text: '#1B5E20' },
};

export default function TrustBadge({ score = 0, badge = 'New', size = 'sm' }) {
  const s     = BADGE_STYLES[badge] || BADGE_STYLES.New;
  const large = size === 'lg';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: s.bg, borderColor: s.border },
      large && styles.badgeLg,
    ]}>
      <Text style={[styles.star, large && styles.starLg]}>⭐</Text>
      <Text style={[styles.score, { color: s.text }, large && styles.scoreLg]}>
        {parseFloat(score).toFixed(1)}
      </Text>
      {large && (
        <Text style={[styles.badgeLabel, { color: s.text }]}> {badge}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge:      {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1,
  },
  badgeLg:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  star:       { fontSize: 11 },
  starLg:     { fontSize: 16 },
  score:      { fontSize: 11, fontWeight: '700', marginLeft: 2 },
  scoreLg:    { fontSize: 16 },
  badgeLabel: { fontSize: 13, fontWeight: '600' },
});
