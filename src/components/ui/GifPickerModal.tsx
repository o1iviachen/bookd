import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput as RNTextInput,
  useWindowDimensions,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { searchGifs, featuredGifs, TenorGif } from '../../services/tenor';

interface GifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gif: TenorGif) => void;
}

export function GifPickerModal({ visible, onClose, onSelect }: GifPickerModalProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const { width: screenWidth } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colWidth = (screenWidth - spacing.md * 2 - spacing.sm) / 2;

  const loadFeatured = useCallback(async () => {
    setLoading(true);
    try {
      const result = await featuredGifs(30);
      setGifs(result.gifs);
    } catch (e) {
      console.error('[GifPicker] featured load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setGifs([]);
      loadFeatured();
    }
  }, [visible, loadFeatured]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      loadFeatured();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchGifs(text.trim(), 30);
        setGifs(result.gifs);
      } catch (e) {
        console.error('[GifPicker] search error:', e);
      }
      setLoading(false);
    }, 300);
  }, [loadFeatured]);

  const renderGif = useCallback(({ item }: { item: TenorGif }) => {
    const aspectRatio = item.width / item.height;
    const height = colWidth / aspectRatio;

    return (
      <Pressable
        onPress={() => onSelect(item)}
        style={({ pressed }) => ({
          width: colWidth,
          marginBottom: spacing.sm,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Image
          source={{ uri: item.previewUrl }}
          style={{ width: colWidth, height, borderRadius: borderRadius.md }}
          contentFit="cover"
          autoplay
        />
      </Pressable>
    );
  }, [colWidth, spacing.sm, borderRadius.md, onSelect]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>
            Choose a GIF
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>Cancel</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <RNTextInput
            placeholder="Search GIFs"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
            style={{
              backgroundColor: colors.muted,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm + 4,
              paddingVertical: spacing.sm + 2,
              color: colors.foreground,
              fontSize: 15,
            }}
          />
        </View>

        {/* GIF Grid */}
        {loading && gifs.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={gifs}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{
              paddingHorizontal: spacing.md,
              justifyContent: 'space-between',
            }}
            renderItem={renderGif}
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              !loading ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 3 }}>
                  <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground, marginTop: spacing.md, textAlign: 'center' }}>
                    No GIFs found
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                    Try a different search term
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Powered by Klipy</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
