import { measureAsync, trackApiRequest } from '../../utils/performance';

// Mock performance tracking
jest.mock('../../utils/performance', () => ({
  measureAsync: jest.fn((name, fn) => fn()),
  trackApiRequest: jest.fn(),
  trackScreenLoad: jest.fn(),
  trackOperation: jest.fn(),
  trackAppStartup: jest.fn(),
  trackMemoryUsage: jest.fn(),
}));

describe('API Performance Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track API request performance', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response);

    const startTime = performance.now();
    const response = await fetch('/api/menus');
    const duration = performance.now() - startTime;
    
    await response.json();
    
    // Verify performance tracking was called
    expect(trackApiRequest).toHaveBeenCalled();
  });

  it('should track failed API requests', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: 'Server error' }),
    } as Response);

    const response = await fetch('/api/menus');
    const duration = 100; // Mock duration
    
    trackApiRequest('/api/menus', duration, false);
    
    expect(trackApiRequest).toHaveBeenCalledWith('/api/menus', duration, false);
  });
});
