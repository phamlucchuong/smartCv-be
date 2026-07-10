import { getToken, deleteToken } from 'firebase/messaging'
import { useCallback } from 'react'
import { messaging, firebaseConfig } from '../lib/firebase'
import { subscribeFcmToken, unsubscribeFcmToken } from '@smart-cv/api'

const FCM_TOKEN_KEY = 'smartcv_fcm_token'

async function activateServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  // ready resolves only when there is an active SW, handling all state
  // transitions (installing → waiting → activated) without a manual
  // statechange listener that can miss the event if the SW activates fast.
  const reg = await navigator.serviceWorker.ready

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SW config timeout')), 5000)
    navigator.serviceWorker.addEventListener('message', function handler(event) {
      if (event.data?.type === 'FIREBASE_CONFIG_ACK') {
        clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('message', handler)
        resolve()
      }
    })
    reg.active!.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig })
  })

  return reg
}

export function usePushNotifications() {
  const subscribe = async (): Promise<void> => {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Permission denied')
    if (!messaging) throw new Error('Messaging unavailable')
    const reg = await activateServiceWorker()
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    })
    await subscribeFcmToken(token)
    localStorage.setItem(FCM_TOKEN_KEY, token)
  }

  const unsubscribe = async (): Promise<void> => {
    const token = localStorage.getItem(FCM_TOKEN_KEY)
    if (!token || !messaging) return
    await deleteToken(messaging)
    await unsubscribeFcmToken(token)
    localStorage.removeItem(FCM_TOKEN_KEY)
  }

  const initPushSubscription = useCallback(async (): Promise<void> => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (localStorage.getItem(FCM_TOKEN_KEY)) return
    if (!messaging) return
    try {
      const reg = await activateServiceWorker()
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      })
      await subscribeFcmToken(token)
      localStorage.setItem(FCM_TOKEN_KEY, token)
    } catch {
      // Silently ignore — push works on next explicit subscribe
    }
  }, [])

  const currentPermission = (): NotificationPermission =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'

  return { subscribe, unsubscribe, initPushSubscription, currentPermission }
}
