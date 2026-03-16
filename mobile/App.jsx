// mobile/App.jsx
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Auth screens
import LoginScreen    from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

// Main screens
import CropFilterScreen from './screens/Crops/CropFilterScreen';
import CropDetailScreen from './screens/Crops/CropDetailScreen';
import AddCropScreen    from './screens/Crops/AddCropScreen';
import ListingsScreen   from './screens/Listings/ListingsScreen';
import AddListingScreen from './screens/Listings/AddListingScreen';
import ServicesScreen   from './screens/Services/ServicesScreen';
import AddServiceScreen from './screens/Services/AddServiceScreen';
import ProfileScreen    from './screens/Profile/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const tabIcon = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4, marginTop: 2 }}>{emoji}</Text>
);

// Pass onLogout down to ProfileScreen via Tab.Screen children prop
function MainTabs({ onLogout }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   '#1B6B35',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth:  1,
          borderTopColor:  '#F0F0F0',
          height:          52 + insets.bottom,
          paddingBottom:   insets.bottom + 4,
          paddingTop:      6,
          elevation:       12,
          shadowColor:     '#000',
          shadowOpacity:   0.08,
          shadowOffset:    { width: 0, height: -3 },
          shadowRadius:    8,
        },
        tabBarLabelStyle: {
          fontSize:    10,
          fontWeight:  '600',
          marginBottom: 2,
        },
      }}
    >
      <Tab.Screen
        name="Crops"
        component={CropFilterScreen}
        options={{ title: 'Marketplace', tabBarIcon: tabIcon('🌾') }}
      />
      <Tab.Screen
        name="Listings"
        component={ListingsScreen}
        options={{ title: 'Rentals', tabBarIcon: tabIcon('🏡') }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesScreen}
        options={{ title: 'Services', tabBarIcon: tabIcon('🚜') }}
      />
      <Tab.Screen
        name="Profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }}
      >
        {/* Pass onLogout prop to ProfileScreen */}
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
    } catch (_) {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin  = () => setIsLoggedIn(true);
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setIsLoggedIn(false);
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <Text style={styles.splashEmoji}>🌾</Text>
          <Text style={styles.splashTitle}>AgriApp</Text>
          <ActivityIndicator size="large" color="#1B6B35" style={{ marginTop: 24 }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            <>
              <Stack.Screen name="Main">
                {() => <MainTabs onLogout={handleLogout} />}
              </Stack.Screen>
              <Stack.Screen
                name="CropDetail"
                component={CropDetailScreen}
                options={{
                  headerShown: true, title: 'Crop Details',
                  headerTintColor: '#1B6B35',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTitleStyle: { fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="AddCrop"
                component={AddCropScreen}
                options={{
                  headerShown: true, title: 'List a Crop',
                  headerTintColor: '#1B6B35',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTitleStyle: { fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="AddListing"
                component={AddListingScreen}
                options={{
                  headerShown: true, title: 'Add Rental',
                  headerTintColor: '#1B6B35',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTitleStyle: { fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="AddService"
                component={AddServiceScreen}
                options={{
                  headerShown: true, title: 'List a Service',
                  headerTintColor: '#1B6B35',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTitleStyle: { fontWeight: '700' },
                }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login">
                {(props) => <LoginScreen    {...props} onLogin={handleLogin} />}
              </Stack.Screen>
              <Stack.Screen name="Register">
                {(props) => <RegisterScreen {...props} onLogin={handleLogin} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#F7F9F7',
  },
  splashEmoji: { fontSize: 64, marginBottom: 8 },
  splashTitle: { fontSize: 32, fontWeight: '800', color: '#1B6B35' },
});
