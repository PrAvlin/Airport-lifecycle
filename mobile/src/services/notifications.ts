import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { FlightUpdateEvent } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForLocalNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('flight-updates', {
      name: 'Flight updates',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

const NOTIFIABLE_EVENTS = new Set(['gate_change', 'boarding_method_change', 'delay', 'status_change']);

export async function notifyFlightUpdate(event: FlightUpdateEvent): Promise<void> {
  if (!NOTIFIABLE_EVENTS.has(event.type)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${event.flight.flightNumber} update`,
      body: event.message,
      data: { flightNumber: event.flight.flightNumber, type: event.type },
    },
    trigger: null,
  });
}
