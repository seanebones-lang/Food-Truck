import { validateAccessibilityProps, getAccessibilityRecommendations } from '../accessibility.test';
import type { AccessibilityProps } from '../accessibility';

describe('Accessibility Utilities', () => {
  describe('validateAccessibilityProps', () => {
    it('should pass validation for complete props', () => {
      const props: AccessibilityProps = {
        accessible: true,
        accessibilityLabel: 'Test button',
        accessibilityRole: 'button',
      };

      const errors = validateAccessibilityProps(props);
      expect(errors).toHaveLength(0);
    });

    it('should fail when accessible but no label', () => {
      const props: AccessibilityProps = {
        accessible: true,
        accessibilityRole: 'button',
      };

      const errors = validateAccessibilityProps(props);
      expect(errors).toContain('Accessible elements must have an accessibilityLabel');
    });

    it('should fail when button has no label', () => {
      const props: AccessibilityProps = {
        accessibilityRole: 'button',
      };

      const errors = validateAccessibilityProps(props);
      expect(errors).toContain('Buttons must have an accessibilityLabel');
    });

    it('should fail when image has no label', () => {
      const props: AccessibilityProps = {
        accessibilityRole: 'image',
      };

      const errors = validateAccessibilityProps(props);
      expect(errors).toContain('Images must have an accessibilityLabel');
    });
  });

  describe('getAccessibilityRecommendations', () => {
    it('should return list of recommendations', () => {
      const recommendations = getAccessibilityRecommendations();
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toContain('Test with TalkBack (Android) and VoiceOver (iOS)');
    });
  });
});
