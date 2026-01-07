/**
 * Theme utilities using central config
 */

import { config, getThemeColor, getSpacing } from './index';
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

type Style = ViewStyle | TextStyle | ImageStyle;

/**
 * Create stylesheet with theme colors and spacing
 */
export const createThemedStyles = <T extends Record<string, Style>>(
  styles: (theme: typeof config.theme) => T
): T => {
  return StyleSheet.create(styles(config.theme));
};

/**
 * Get themed color
 */
export const color = getThemeColor;

/**
 * Get themed spacing
 */
export const spacing = getSpacing;

/**
 * Common themed styles
 */
export const themedStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
  },
  buttonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  text: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
  },
  textSecondary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.fontSize.sm,
  },
}));
