import React, { useState, useRef, useCallback } from 'react';
import { View, Modal, Pressable, Dimensions, FlatList, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReviewMedia } from '../../types/review';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  media: ReviewMedia[];
  initialIndex: number;
  onClose: () => void;
}

function VideoItem({ item }: { item: ReviewMedia }) {
  const [loading, setLoading] = useState(true);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded && loading) setLoading(false);
  }, [loading]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Video
        source={{ uri: item.url }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        shouldPlay
        onPlaybackStatusUpdate={onStatus}
      />
      {loading && (
        <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Loading video...</Text>
        </View>
      )}
    </View>
  );
}

export function MediaViewer({ visible, media, initialIndex, onClose }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const renderItem = ({ item }: { item: ReviewMedia }) => {
    if (item.type === 'video') {
      return <VideoItem item={item} />;
    }
    return (
      <Pressable
        onPress={onClose}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
      >
        <Image
          source={{ uri: item.url }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
          contentFit="contain"
        />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 16,
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 20,
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        {/* Page indicator */}
        {media.length > 1 && (
          <View style={{
            position: 'absolute',
            top: insets.top + 18,
            left: 0,
            right: 0,
            zIndex: 10,
            alignItems: 'center',
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' }}>
              {currentIndex + 1} / {media.length}
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={media}
          renderItem={renderItem}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(idx);
          }}
        />
      </View>
    </Modal>
  );
}
