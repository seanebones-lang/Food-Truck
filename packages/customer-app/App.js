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
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { MapScreen } from './src/screens/MapScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';

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
        component={LoginScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ title: 'Sign Up' }}
      />
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
        component={MenuScreen}
        options={{ title: 'Menu' }}
      />
      <Stack.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Find Trucks' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notification Settings' }}
      />
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
    <I18nextProvider i18n={i18n}>
      <Provider store={store}>
        <PersistGate loading={<ActivityIndicator size="large" color="#f4511e" />} persistor={persistor}>
          <AppContent />
        </PersistGate>
      </Provider>
    </I18nextProvider>
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
