# Testing Guide

## Overview

This project uses:
- **Jest 29.7.0** for unit and integration tests
- **Detox 20.3.0** for end-to-end (e2e) tests
- **@testing-library/react-native** for component testing
- **Coverage threshold**: 80%+ for branches, functions, lines, and statements

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Build for iOS
npm run test:e2e:build-ios

# Build for Android
npm run test:e2e:build-android

# Run e2e tests
npm run test:e2e
```

## Test Structure

```
src/
├── __tests__/          # Unit tests
│   ├── components/
│   ├── services/
│   └── utils/
├── config/
│   └── __tests__/      # Config tests
└── ...

e2e/                    # E2E tests
├── firstTest.e2e.ts
└── jest.config.js
```

## Writing Unit Tests

### Component Tests

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibleButton } from '../AccessibleButton';

describe('AccessibleButton', () => {
  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AccessibleButton i18nKey="common.save" onPress={onPress} />
    );

    fireEvent.press(getByText('common.save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Service Tests with Mocks

```tsx
import { AuthService } from '../authService';

// Mock external dependencies
jest.mock('../../utils/storage');
global.fetch = jest.fn();

describe('AuthService', () => {
  it('should login successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { user: {...} } }),
    });

    const result = await authService.login('test@example.com', 'password');
    expect(result.success).toBe(true);
  });
});
```

## Writing E2E Tests

### Basic E2E Test

```typescript
describe('Authentication Flow', () => {
  it('should allow user to login', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### Test IDs

Add test IDs to components for e2e testing:

```tsx
<TouchableOpacity
  testID="login-button"
  accessibilityLabel="Login"
  onPress={handleLogin}
>
  <Text>Login</Text>
</TouchableOpacity>
```

## Mocking External Services

### API Calls

```tsx
global.fetch = jest.fn();

beforeEach(() => {
  global.fetch.mockClear();
});

it('should handle API errors', async () => {
  global.fetch.mockRejectedValueOnce(new Error('Network error'));
  
  await expect(service.fetchData()).rejects.toThrow('Network error');
});
```

### Expo Modules

```tsx
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 37.7749, longitude: -122.4194 },
    })
  ),
}));
```

### AsyncStorage

```tsx
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

## Coverage Goals

- **Branches**: 80%+
- **Functions**: 80%+
- **Lines**: 80%+
- **Statements**: 80%+

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Test what the user sees/experiences
   - Avoid testing internal implementation details

2. **Use Descriptive Test Names**
   ```tsx
   // Good
   it('should show error message when login fails', () => {});
   
   // Bad
   it('test login', () => {});
   ```

3. **Arrange-Act-Assert Pattern**
   ```tsx
   it('should calculate total correctly', () => {
     // Arrange
     const items = [{ price: 10 }, { price: 20 }];
     
     // Act
     const total = calculateTotal(items);
     
     // Assert
     expect(total).toBe(30);
   });
   ```

4. **Mock External Dependencies**
   - Mock API calls
   - Mock native modules
   - Mock third-party services

5. **Test Edge Cases**
   - Empty states
   - Error states
   - Loading states
   - Boundary conditions

6. **Keep Tests Fast**
   - Use mocks for slow operations
   - Avoid unnecessary async operations
   - Use `beforeEach` for setup

## E2E Test Best Practices

1. **Use Test IDs**
   - More reliable than text matching
   - Works across languages

2. **Wait for Elements**
   ```tsx
   await waitFor(element(by.id('screen')))
     .toBeVisible()
     .withTimeout(5000);
   ```

3. **Test User Flows**
   - Complete user journeys
   - Not just individual screens

4. **Clean State**
   - Reset app state between tests
   - Use `beforeEach` for setup

5. **Handle Async Operations**
   - Wait for network requests
   - Wait for animations
   - Wait for navigation

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: npm test -- --coverage

- name: Run e2e tests
  run: npm run test:e2e
```

## Troubleshooting

### Tests Failing Randomly
- Check for race conditions
- Add proper waits
- Ensure mocks are reset

### E2E Tests Timing Out
- Increase timeout values
- Check device/emulator performance
- Verify app builds correctly

### Coverage Below Threshold
- Review uncovered code
- Add tests for edge cases
- Remove dead code

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
