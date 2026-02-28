import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function PulsingDot({ size = 6 }: { size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#00e054', opacity }} />;
}
