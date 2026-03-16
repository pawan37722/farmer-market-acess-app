// mobile/navigation/AppNavigator.jsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Auth screens
import LoginScreen    from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// Main screens
import CropFilterScreen from '../screens/Crops/CropFilterScreen';
import CropDetailScreen from '../screens/Crops/CropDetailScreen';
import AddCropScreen    from '../screens/Crops/AddCropScreen';

import ListingsScreen    from '../screens/Listings/ListingsScreen';
import AddListingScreen  from '../screens/Listings/AddListingScreen';

import ServicesScreen   from '../screens/Services/ServicesScreen';
import AddServiceScreen from '../screens/Services/AddServiceScreen';

import ProfileScreen from '../screens/Profile/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab icons (emoji fallback — replace with icons if desired) ─
const tabIcon = (name) => ({ focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{name}</Text>
);

// ── Bottom tab navigator ──────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:       false,
        tabBarActiveTintColor:   '#1B6B35',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { paddingBottom: 4, height: 58 },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
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
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

// ── Root stack navigator ──────────────────────────────────────
export default function AppNavigator({ isLoggedIn }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main"       component={MainTabs} />
            <Stack.Screen name="CropDetail" component={CropDetailScreen}
              options={{ headerShown: true, title: 'Crop Details', headerTintColor: '#1B6B35' }} />
            <Stack.Screen name="AddCrop"    component={AddCropScreen}
              options={{ headerShown: true, title: 'List a Crop', headerTintColor: '#1B6B35' }} />
            <Stack.Screen name="AddListing" component={AddListingScreen}
              options={{ headerShown: true, title: 'Add Rental', headerTintColor: '#1B6B35' }} />
            <Stack.Screen name="AddService" component={AddServiceScreen}
              options={{ headerShown: true, title: 'List a Service', headerTintColor: '#1B6B35' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
