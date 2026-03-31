import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studyhub.app',
  appName: 'StudyHub',
  webDir: 'www',
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  server: {
    url: 'https://studyhub-olive.vercel.app',
    cleartext: true,
    allowNavigation: [
      "studyhub-olive.vercel.app",
      "*.vercel.app",
      "accounts.google.com",
      "*"
    ]
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '1008112389846-sde4hhs4eml149v2tf1cr1iqs21qfqrj.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
