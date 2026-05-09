import React, { useEffect, useRef } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';

const ND = Platform.OS !== 'web';

interface Props {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
  fromY?: number;
}

export function FadeSlideIn({ children, delay = 0, style, fromY = 18 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: ND,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: ND,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style as ViewStyle, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function FadeIn({ children, delay = 0, style }: Omit<Props, 'fromY'>) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: ND,
    }).start();
  }, []);

  return (
    <Animated.View style={[style as ViewStyle, { opacity }]}>
      {children}
    </Animated.View>
  );
}
