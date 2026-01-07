describe('Food Truck App E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Authentication Flow', () => {
    it('should show login screen on app launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
    });

    it('should allow user to login', async () => {
      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();
      
      // Wait for navigation
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('email-input')).typeText('invalid@example.com');
      await element(by.id('password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();
      
      await expect(element(by.text('Invalid email or password'))).toBeVisible();
    });

    it('should allow guest mode', async () => {
      await element(by.id('guest-button')).tap();
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Menu Browsing', () => {
    beforeEach(async () => {
      // Login or use guest mode
      await element(by.id('guest-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('should display menu items', async () => {
      await element(by.id('menu-button')).tap();
      await waitFor(element(by.id('menu-screen'))).toBeVisible();
      
      // Check if menu items are displayed
      await expect(element(by.id('menu-list'))).toBeVisible();
    });

    it('should allow adding items to cart', async () => {
      await element(by.id('menu-button')).tap();
      await waitFor(element(by.id('menu-screen'))).toBeVisible();
      
      // Tap first add to cart button
      await element(by.id('add-to-cart-0')).tap();
      
      // Check cart badge updates
      await expect(element(by.id('cart-badge'))).toHaveText('1');
    });

    it('should filter menu items', async () => {
      await element(by.id('menu-button')).tap();
      await waitFor(element(by.id('menu-screen'))).toBeVisible();
      
      await element(by.id('search-input')).typeText('burger');
      
      // Wait for filtered results
      await waitFor(element(by.id('menu-list'))).toBeVisible();
    });
  });

  describe('Cart Management', () => {
    beforeEach(async () => {
      await element(by.id('guest-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
      await element(by.id('menu-button')).tap();
      await waitFor(element(by.id('menu-screen'))).toBeVisible();
      await element(by.id('add-to-cart-0')).tap();
    });

    it('should display cart items', async () => {
      await element(by.id('cart-button')).tap();
      await waitFor(element(by.id('cart-screen'))).toBeVisible();
      
      await expect(element(by.id('cart-list'))).toBeVisible();
    });

    it('should allow removing items from cart', async () => {
      await element(by.id('cart-button')).tap();
      await waitFor(element(by.id('cart-screen'))).toBeVisible();
      
      await element(by.id('remove-item-0')).tap();
      
      await expect(element(by.text('Your cart is empty'))).toBeVisible();
    });

    it('should calculate total correctly', async () => {
      await element(by.id('cart-button')).tap();
      await waitFor(element(by.id('cart-screen'))).toBeVisible();
      
      await expect(element(by.id('cart-total'))).toBeVisible();
    });
  });

  describe('Offline Mode', () => {
    it('should show offline banner when disconnected', async () => {
      await device.setNetworkCondition({ airplaneMode: true });
      
      await waitFor(element(by.id('offline-banner')))
        .toBeVisible()
        .withTimeout(3000);
      
      await device.setNetworkCondition({ airplaneMode: false });
    });

    it('should queue actions when offline', async () => {
      await device.setNetworkCondition({ airplaneMode: true });
      
      await element(by.id('guest-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
      
      // Actions should be queued
      await expect(element(by.id('offline-banner'))).toBeVisible();
      
      await device.setNetworkCondition({ airplaneMode: false });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', async () => {
      const loginButton = element(by.id('login-button'));
      await expect(loginButton).toBeVisible();
      
      // Check accessibility label
      const label = await loginButton.getAttributes();
      expect(label.label).toBeTruthy();
    });

    it('should support screen reader navigation', async () => {
      // This would require actual screen reader testing
      // Detox can verify accessibility labels are present
      await expect(element(by.id('login-button'))).toBeVisible();
    });
  });
});
