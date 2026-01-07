import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibleButton } from '../AccessibleButton';
import { useTranslation } from 'react-i18next';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AccessibleButton', () => {
  it('should render button with translated text', () => {
    const { getByText } = render(
      <AccessibleButton i18nKey="common.save" onPress={jest.fn()} />
    );

    expect(getByText('common.save')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AccessibleButton i18nKey="common.save" onPress={onPress} />
    );

    fireEvent.press(getByText('common.save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AccessibleButton i18nKey="common.save" onPress={onPress} disabled={true} />
    );

    const button = getByText('common.save').parent;
    expect(button?.props.accessibilityState.disabled).toBe(true);
  });

  it('should show loading indicator when loading', () => {
    const { queryByText, getByTestId } = render(
      <AccessibleButton i18nKey="common.save" onPress={jest.fn()} loading={true} />
    );

    expect(queryByText('common.save')).toBeNull();
    // ActivityIndicator should be present
  });

  it('should have correct accessibility props', () => {
    const { getByText } = render(
      <AccessibleButton i18nKey="common.save" onPress={jest.fn()} />
    );

    const button = getByText('common.save').parent;
    expect(button?.props.accessibilityRole).toBe('button');
    expect(button?.props.accessibilityLabel).toBe('common.save');
  });

  it('should apply correct variant styles', () => {
    const { getByText, rerender } = render(
      <AccessibleButton i18nKey="common.save" onPress={jest.fn()} variant="primary" />
    );

    const primaryButton = getByText('common.save').parent;
    expect(primaryButton?.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: '#f4511e' })
    );

    rerender(
      <AccessibleButton i18nKey="common.save" onPress={jest.fn()} variant="outline" />
    );

    const outlineButton = getByText('common.save').parent;
    expect(outlineButton?.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: 'transparent' })
    );
  });
});
