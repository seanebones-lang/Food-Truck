import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { I18nextProvider } from 'react-i18next';
import './src/i18n/config'; // Initialize i18n
import i18n from './src/i18n/config';
import { initSentry } from './src/utils/sentry';
import { store, persistor } from './src/store';

// Initialize Sentry before anything else
initSentry();

// Track app startup performance
import { trackAppStartup } from './src/utils/performance';
trackAppStartup();
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useNotifications } from './src/hooks/useNotifications';
import { useConnectivity } from './src/hooks/useConnectivity';
import { OfflineBanner } from './src/components/OfflineBanner';
import { ConflictResolutionModal } from './src/components/ConflictResolutionModal';
import { ErrorBoundary } from './src/components/ErrorBoundary';
// Lazy load screens for code splitting
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const LoginScreen = lazy(() => import('./src/screens/LoginScreen').then(module => ({ default: module.LoginScreen })));
const SignupScreen = lazy(() => import('./src/screens/SignupScreen').then(module => ({ default: module.SignupScreen })));
const ProfileScreen = lazy(() => import('./src/screens/ProfileScreen').then(module => ({ default: module.ProfileScreen })));
const MenuScreen = lazy(() => import('./src/screens/MenuScreen').then(module => ({ default: module.MenuScreen })));
const MapScreen = lazy(() => import('./src/screens/MapScreen').then(module => ({ default: module.MapScreen })));
const NotificationSettingsScreen = lazy(() => import('./src/screens/NotificationSettingsScreen').then(module => ({ default: module.NotificationSettingsScreen })));

// Loading fallback component
const ScreenLoader = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#f4511e" />
  </View>
);

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const { user, isGuest, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Food Truck App</Text>
      <Text style={styles.subtitle}>
        {user ? `Welcome, ${user.name}!` : isGuest ? 'Welcome, Guest!' : 'Welcome to the customer app!'}
      </Text>
      <StatusBar style="auto" />
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Menu')}
        >
          <Text style={styles.buttonText}>View Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Map')}
        >
          <Text style={styles.buttonText}>Find Trucks</Text>
        </TouchableOpacity>
        {!isGuest && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.buttonText}>Profile</Text>
          </TouchableOpacity>
        )}
        {isGuest && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              await logout();
            }}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f4511e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Login"
        options={{ title: 'Sign In' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <LoginScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Signup"
        options={{ title: 'Sign Up' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <SignupScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f4511e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Food Truck' }}
      />
      <Stack.Screen
        name="Menu"
        options={{ title: 'Menu' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <MenuScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Map"
        options={{ title: 'Find Trucks' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <MapScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Profile"
        options={{ title: 'Profile' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <ProfileScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="NotificationSettings"
        options={{ title: 'Notification Settings' }}
      >
        {props => (
          <Suspense fallback={<ScreenLoader />}>
            <NotificationSettingsScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f4511e" />
      </View>
    );
  }

  if (isAuthenticated || isGuest) {
    return <AppStack />;
  }

  return <AuthStack />;
}

function NotificationWrapper({ children }) {
  useNotifications(); // Initialize notifications
  return children;
}

function ConnectivityWrapper({ children }) {
  useConnectivity(); // Initialize connectivity monitoring
  return children;
}

function AppContent() {
  return (
    <AuthProvider>
      <ConnectivityWrapper>
        <NotificationWrapper>
          <OfflineBanner />
          <ConflictResolutionModal />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </NotificationWrapper>
      </ConnectivityWrapper>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <PersistGate loading={<ActivityIndicator size="large" color="#f4511e" />} persistor={persistor}>
            <AppContent />
          </PersistGate>
        </Provider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#f4511e',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#f4511e',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#f4511e',
    fontSize: 16,
    fontWeight: '600',
  },
});
