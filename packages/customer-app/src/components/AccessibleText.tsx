import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRTLStyles } from '../utils/accessibility';

interface AccessibleTextProps extends TextProps {
  i18nKey: string;
  i18nOptions?: { [key: string]: any };
  accessibilityLabelKey?: string;
  accessibilityHintKey?: string;
}

/**
 * Accessible Text component with i18n and accessibility support
 */
export const AccessibleText: React.FC<AccessibleTextProps> = ({
  i18nKey,
  i18nOptions,
  accessibilityLabelKey,
  accessibilityHintKey,
  style,
  ...props
}) => {
  const { t } = useTranslation();
  const { getTextAlign } = useRTLStyles();

  const text = t(i18nKey, i18nOptions);
  const accessibilityLabel = accessibilityLabelKey
    ? t(accessibilityLabelKey, i18nOptions)
    : text;

  return (
    <Text
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHintKey ? t(accessibilityHintKey, i18nOptions) : undefined}
      style={[styles.text, style, { textAlign: getTextAlign('left') }]}
      {...props}
    >
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    color: '#333',
  },
});
