import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'expo-image';
import {useEffect, useState} from 'react';
import type {StyleProp} from 'react-native';
import type {ImageStyle} from 'expo-image';
import {API_BASE_URL} from '../services/apiClient';

/** An image served by our API (vehicle or profile photo): it needs the bearer token as a header. */
export function AuthedImage({path, style}: {path: string; style: StyleProp<ImageStyle>}) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    void AsyncStorage.getItem('access_token').then(setToken);
  }, []);
  if (!token) {
    return null;
  }
  return (
    <Image
      source={{uri: `${API_BASE_URL}${path}`, headers: {Authorization: `Bearer ${token}`}, cacheKey: path}}
      contentFit="cover"
      transition={200}
      accessibilityIgnoresInvertColors
      style={style}
    />
  );
}
