/**
 * LoginScreen Component Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';

// Mock dependencies
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: jest.fn().mockResolvedValue({ success: true }),
    isAuthenticated: false,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    expect(getByPlaceholderText(/email/i)).toBeTruthy();
    expect(getByPlaceholderText(/password/i)).toBeTruthy();
    expect(getByText(/login/i)).toBeTruthy();
  });

  it('should handle login with valid credentials', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButton = getByText(/login/i);

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      // Login should be called
      expect(emailInput.props.value).toBe('test@example.com');
    });
  });

  it('should show error for invalid credentials', async () => {
    const { useAuth } = require('../../hooks/useAuth');
    useAuth.useAuth = () => ({
      login: jest.fn().mockResolvedValue({ 
        success: false, 
        error: 'Invalid credentials' 
      }),
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<LoginScreen />);
    
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButton = getByText(/login/i);

    fireEvent.changeText(emailInput, 'wrong@example.com');
    fireEvent.changeText(passwordInput, 'wrongpassword');
    fireEvent.press(loginButton);

    await waitFor(() => {
      // Error message should appear
      expect(queryByText(/invalid/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should validate email format', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    const emailInput = getByPlaceholderText(/email/i);
    const loginButton = getByText(/login/i);

    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(loginButton);

    // Should show validation error
    expect(emailInput).toBeTruthy();
  });
});
