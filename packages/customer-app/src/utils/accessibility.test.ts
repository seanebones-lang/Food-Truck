/**
 * Accessibility testing utilities
 * Note: React Native accessibility testing differs from web
 * Consider using react-native-testing-library for component tests
 * and manual testing with screen readers (TalkBack on Android, VoiceOver on iOS)
 */

import { AccessibilityProps } from './accessibility';

/**
 * Validate accessibility props
 */
export function validateAccessibilityProps(props: AccessibilityProps): string[] {
  const errors: string[] = [];

  if (props.accessible && !props.accessibilityLabel) {
    errors.push('Accessible elements must have an accessibilityLabel');
  }

  if (props.accessibilityRole === 'button' && !props.accessibilityLabel) {
    errors.push('Buttons must have an accessibilityLabel');
  }

  if (props.accessibilityRole === 'image' && !props.accessibilityLabel) {
    errors.push('Images must have an accessibilityLabel');
  }

  return errors;
}

/**
 * Get accessibility test recommendations
 */
export function getAccessibilityRecommendations(): string[] {
  return [
    'Test with TalkBack (Android) and VoiceOver (iOS)',
    'Ensure all interactive elements have minimum 44x44 touch targets',
    'Verify color contrast ratios meet WCAG AA standards',
    'Test keyboard navigation (if applicable)',
    'Verify all images have descriptive alt text',
    'Ensure dynamic content changes are announced',
    'Test with different text sizes (system accessibility settings)',
    'Verify RTL layout works correctly for RTL languages',
    'Test with reduced motion settings',
    'Verify focus indicators are visible',
  ];
}

/**
 * Mock accessibility tree for testing
 */
export interface AccessibilityNode {
  role: string;
  label: string;
  hint?: string;
  state?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean;
  };
  children?: AccessibilityNode[];
}

export function buildAccessibilityTree(
  props: AccessibilityProps,
  children?: AccessibilityNode[]
): AccessibilityNode {
  return {
    role: props.accessibilityRole || 'none',
    label: props.accessibilityLabel || '',
    hint: props.accessibilityHint,
    state: props.accessibilityState,
    children,
  };
}
