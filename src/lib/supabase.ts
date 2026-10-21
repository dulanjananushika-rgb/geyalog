import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const parsedUrl = (() => { try { return url ? new URL(url) : null; } catch { return null; } })();
export const isSupabaseConfigured = Boolean(parsedUrl && key && !url?.includes('your-project'));
const projectRef = parsedUrl?.hostname.split('.')[0] || 'unconfigured';
const storageKey = `sb-${projectRef}-auth-token`;

// Native auth tokens live in the OS encrypted Keychain/Keystore. Web uses the
// browser's storage because SecureStore is a native-only module.
const authStorage = Platform.OS === 'web'
  ? {
      getItem: async (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
      setItem: async (key: string, value: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
      removeItem: async (key: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
    }
  : {
      getItem: async (key: string) => {
        const securedValue = await SecureStore.getItemAsync(key);
        if (securedValue !== null) return securedValue;
        // Phase 0 stored sessions in AsyncStorage. Move an existing session to
        // Keychain/Keystore on its first read, then remove the unencrypted copy.
        const legacyValue = await AsyncStorage.getItem(key);
        if (legacyValue !== null) {
          await SecureStore.setItemAsync(key, legacyValue);
          await AsyncStorage.removeItem(key);
        }
        return legacyValue;
      },
      setItem: async (key: string, value: string) => {
        await SecureStore.setItemAsync(key, value);
        await AsyncStorage.removeItem(key);
      },
      removeItem: async (key: string) => {
        await SecureStore.deleteItemAsync(key);
        await AsyncStorage.removeItem(key);
      },
    };

export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { storage: authStorage, storageKey, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
