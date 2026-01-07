/**
 * ErrorBoundary Component Tests (React Native)
 * 
 * Tests for the ErrorBoundary component in the customer app.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

// Mock __DEV__
const mockDev = true;

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary (React Native)', () => {
  beforeEach(() => {
    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(getByText('Test content')).toBeTruthy();
  });

  it('should render error UI when error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText(/Something went wrong/i)).toBeTruthy();
    expect(getByText(/try again/i)).toBeTruthy();
  });

  it('should show try again button', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText(/Try Again/i)).toBeTruthy();
  });

  it('should show error details in development mode', () => {
    // Mock __DEV__ for this test
    const originalDev = global.__DEV__;
    global.__DEV__ = true;

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText(/Error Details/i)).toBeTruthy();

    global.__DEV__ = originalDev;
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom error message')).toBeTruthy();
  });
});
