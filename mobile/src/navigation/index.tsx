import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SearchScreen } from '../screens/SearchScreen';
import { JourneyScreen } from '../screens/JourneyScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Search: undefined;
  Journey: { flightNumber: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Journey"
        component={JourneyScreen}
        options={({ route }) => ({ title: route.params.flightNumber, headerShown: false })}
      />
    </Stack.Navigator>
  );
}
