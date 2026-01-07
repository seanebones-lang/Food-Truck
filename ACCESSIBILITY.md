# Accessibility & Internationalization Guide

## Overview

This project implements comprehensive accessibility and internationalization (i18n) support using:
- **react-i18next 14.1.0** for translations
- **React Native Accessibility API** for screen reader support
- **RTL (Right-to-Left) language support** for Arabic, Hebrew, and other RTL languages
- **Automated accessibility testing** tools

## Supported Languages

- English (en) - LTR
- Spanish (es) - LTR
- French (fr) - LTR
- Arabic (ar) - RTL

## Usage

### Translation in Components

```tsx
import { useTranslation } from 'react-i18next';
import { AccessibleText } from '../components/AccessibleText';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <AccessibleText 
      i18nKey="menu.item" 
      i18nOptions={{ name: "Burger", price: "$12.99" }}
      accessibilityLabelKey="accessibility.menuItem"
    />
  );
}
```

### Accessible Buttons

```tsx
import { AccessibleButton } from '../components/AccessibleButton';

<AccessibleButton
  i18nKey="common.save"
  onPress={handleSave}
  accessibilityHintKey="auth.saveHint"
/>
```

### RTL Support

The app automatically detects and applies RTL layouts for RTL languages:

```tsx
import { useRTLStyles } from '../utils/accessibility';

const { isRTL, getRTLStyle, getTextAlign } = useRTLStyles();

<Text style={{ textAlign: getTextAlign('left') }}>
  {t('menu.title')}
</Text>
```

## Accessibility Best Practices

### 1. ARIA Labels and Accessibility Props

All interactive elements should have:
- `accessibilityLabel` - Descriptive label for screen readers
- `accessibilityRole` - Semantic role (button, link, image, etc.)
- `accessibilityHint` - Additional context when needed
- `accessibilityState` - Current state (disabled, selected, etc.)

### 2. Minimum Touch Targets

All interactive elements must have a minimum size of **44x44 points**:

```tsx
<TouchableOpacity
  style={{ minHeight: 44, minWidth: 44 }}
  accessibilityRole="button"
  accessibilityLabel={t('common.save')}
/>
```

### 3. Color Contrast

Ensure text meets WCAG AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio

### 4. Dynamic Content

Use `accessibilityLiveRegion` for dynamic content:

```tsx
<View accessibilityLiveRegion="polite">
  <Text>{errorMessage}</Text>
</View>
```

## Testing

### Manual Testing

1. **Android (TalkBack)**:
   - Enable TalkBack in Settings > Accessibility
   - Test navigation and content reading

2. **iOS (VoiceOver)**:
   - Enable VoiceOver in Settings > Accessibility
   - Test with gestures and navigation

3. **RTL Testing**:
   - Switch language to Arabic
   - Verify layout flips correctly
   - Test navigation and interactions

### Automated Testing

For React Native, use:
- **react-native-testing-library** for component tests
- **Accessibility Inspector** (iOS) / **Accessibility Scanner** (Android)
- Manual testing with screen readers is essential

### Web (Admin App)

For the admin web app, use:
- **@axe-core/react 4.9.1** for automated accessibility audits
- Browser DevTools Accessibility Inspector
- WAVE browser extension

Example Axe setup:

```tsx
import React from 'react';
import { axe, toHaveNoViolations } from '@axe-core/react';

// In development
if (process.env.NODE_ENV === 'development') {
  axe(React, ReactDOM, 1000);
}

expect.extend(toHaveNoViolations);
```

## RTL Language Support

### Layout Considerations

1. **Flex Direction**: Use `getFlexDirection()` for row layouts
2. **Text Alignment**: Use `getTextAlign()` instead of hardcoded values
3. **Margins/Padding**: Consider mirrored spacing
4. **Icons**: Some icons may need to be mirrored

### Testing RTL

1. Change language to Arabic
2. Verify all layouts flip correctly
3. Test navigation flow
4. Check form inputs and buttons
5. Verify images and icons

## Cultural Considerations

### Translation Quality

1. **Professional Translation**: Use native speakers
2. **Cultural Context**: Adapt content for cultural appropriateness
3. **Date/Time Formats**: Use locale-appropriate formats
4. **Number Formats**: Respect locale-specific number formatting

### Cultural Testing

- Involve diverse testers from target regions
- Test with native speakers
- Verify cultural sensitivity
- Check for offensive or inappropriate content

## Regular Audits

### Weekly
- Run automated accessibility checks
- Review new components for accessibility

### Monthly
- Comprehensive screen reader testing
- RTL layout verification
- User testing with diverse users

### Quarterly
- Full accessibility audit
- Update translation files
- Review and update accessibility guidelines

## Resources

- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)

## Common Issues

### Issue: Screen reader not reading text
**Solution**: Ensure `accessible={true}` and `accessibilityLabel` are set

### Issue: RTL layout not working
**Solution**: Use `useRTLStyles` hook instead of hardcoded styles

### Issue: Touch targets too small
**Solution**: Ensure minimum 44x44 points for all interactive elements

### Issue: Translation not updating
**Solution**: Check i18n initialization and ensure translations are loaded
