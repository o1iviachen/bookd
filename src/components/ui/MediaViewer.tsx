import React, { useState } from 'react';
import { View, Modal, Pressable, Dimensions, FlatList, Text } from 'react-native';
import { Image } from 'expo-image';
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

export function MediaViewer({ visible, media, initialIndex, onClose }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const renderItem = ({ item }: { item: ReviewMedia }) => (
    <Pressable
      onPress={onClose}
      style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
    >
      <Image
        source={{ uri: item.url }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
        contentFit="contain"
        autoplay={item.type === 'gif'}
      />
    </Pressable>
  );

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
          showsVerticalScrollIndicator={false}
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
