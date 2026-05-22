import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageResizeMode,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme';

type Props = {
  uri?: string | null;
  style?: StyleProp<ViewStyle | ImageStyle>;
  resizeMode?: ImageResizeMode;
  fallback?: React.ReactNode;
};

export function FastImage({ uri, style, resizeMode = 'cover', fallback }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return <View style={[styles.base, style]}>{fallback || null}</View>;
  }

  return (
    <View style={[styles.base, style]}>
      {!loaded ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.orange} size="small" />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoaded(true)}
        onError={() => setFailed(true)}
        progressiveRenderingEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: colors.orangeSoft,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orangeSoft,
  },
});
