import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAccessibility, useRTLStyles } from '../utils/accessibility';

interface AccessibleButtonProps {
  i18nKey: string;
  i18nOptions?: { [key: string]: any };
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityHintKey?: string;
}

/**
 * Accessible Button component with i18n and accessibility support
 */
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  i18nKey,
  i18nOptions,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
  accessibilityHintKey,
}) => {
  const { t } = useTranslation();
  const { getButtonProps } = useAccessibility();
  const { getRTLStyle, isRTL } = useRTLStyles();

  const accessibilityProps = getButtonProps(i18nKey, accessibilityHintKey, {
    ...i18nOptions,
    disabled: disabled || loading,
  });

  const buttonStyle = [
    styles.button,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'outline' && styles.buttonOutline,
    disabled && styles.buttonDisabled,
    getRTLStyle(style),
  ];

  const buttonTextStyle = [
    styles.buttonText,
    variant === 'primary' && styles.buttonTextPrimary,
    variant === 'secondary' && styles.buttonTextSecondary,
    variant === 'outline' && styles.buttonTextOutline,
    disabled && styles.buttonTextDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      {...accessibilityProps}
      onPress={onPress}
      disabled={disabled || loading}
      style={buttonStyle}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#f4511e' : '#fff'} />
      ) : (
        <Text style={buttonTextStyle}>{t(i18nKey, i18nOptions)}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Minimum touch target size for accessibility
  },
  buttonPrimary: {
    backgroundColor: '#f4511e',
  },
  buttonSecondary: {
    backgroundColor: '#666',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f4511e',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#fff',
  },
  buttonTextSecondary: {
    color: '#fff',
  },
  buttonTextOutline: {
    color: '#f4511e',
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});
