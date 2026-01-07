// Re-export secure storage for tokens and user storage
// This maintains backward compatibility while using secure storage
export { secureTokenStorage as storage, userStorage } from './secureStorage';
