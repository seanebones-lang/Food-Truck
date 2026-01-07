import { useTranslation } from 'react-i18next';
import { isRTL } from '../i18n/config';

/**
 * Accessibility helper utilities for React Native
 */

export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
}

/**
 * Hook to get accessibility props for common UI elements
 */
export function useAccessibility() {
  const { t } = useTranslation();

  const getButtonProps = (
    labelKey: string,
    hintKey?: string,
    options?: {
      disabled?: boolean;
      [key: string]: any;
    }
  ): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: t(labelKey, options),
      accessibilityHint: hintKey ? t(hintKey, options) : undefined,
      accessibilityState: {
        disabled: options?.disabled,
      },
    };
  };

  const getLinkProps = (labelKey: string, options?: { [key: string]: any }): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'link',
      accessibilityLabel: t(labelKey, options),
    };
  };

  const getImageProps = (
    labelKey: string,
    options?: { [key: string]: any }
  ): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: t(labelKey, options),
    };
  };

  const getTextProps = (
    labelKey: string,
    options?: { [key: string]: any }
  ): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityLabel: t(labelKey, options),
    };
  };

  const getHeaderProps = (labelKey: string, options?: { [key: string]: any }): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'header',
      accessibilityLabel: t(labelKey, options),
    };
  };

  const getListProps = (labelKey: string, options?: { [key: string]: any }): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'list',
      accessibilityLabel: t(labelKey, options),
    };
  };

  const getListItemProps = (
    labelKey: string,
    index: number,
    total: number,
    options?: { [key: string]: any }
  ): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityRole: 'listitem',
      accessibilityLabel: t(labelKey, options),
      accessibilityHint: `${index + 1} of ${total}`,
    };
  };

  return {
    getButtonProps,
    getLinkProps,
    getImageProps,
    getTextProps,
    getHeaderProps,
    getListProps,
    getListItemProps,
  };
}

/**
 * Get RTL-aware style props
 */
export function useRTLStyles() {
  const rtl = isRTL();

  const getRTLStyle = (ltrStyle: any, rtlStyle?: any) => {
    if (!rtl) {
      return ltrStyle;
    }
    return { ...ltrStyle, ...rtlStyle };
  };

  const getFlexDirection = (direction: 'row' | 'column' = 'row') => {
    if (direction === 'row' && rtl) {
      return 'row-reverse';
    }
    return direction;
  };

  const getTextAlign = (align: 'left' | 'right' | 'center' = 'left') => {
    if (rtl) {
      if (align === 'left') return 'right';
      if (align === 'right') return 'left';
    }
    return align;
  };

  return {
    isRTL: rtl,
    getRTLStyle,
    getFlexDirection,
    getTextAlign,
  };
}
