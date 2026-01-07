import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../hooks/reduxHooks';
import { useConnectivity } from '../hooks/useConnectivity';
import { useAccessibility, useRTLStyles } from '../utils/accessibility';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isConnected } = useConnectivity();
  const { queue } = useAppSelector((state) => state.offlineQueue);
  const { getTextProps } = useAccessibility();
  const { getTextAlign } = useRTLStyles();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isConnected ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected, fadeAnim]);

  if (isConnected) {
    return null;
  }

  const queueCount = queue.length;
  const bannerText =
    queueCount > 0
      ? t('offline.queued', { count: queueCount })
      : t('offline.banner');

  return (
    <Animated.View
      style={[styles.banner, { opacity: fadeAnim }]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={bannerText}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { textAlign: getTextAlign('center') }]}>
        {bannerText}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#ff6b6b',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
