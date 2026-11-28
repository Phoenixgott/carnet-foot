import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.phoenixgott.over15methode',
  appName: 'Outsiders',
  webDir: 'dist',
  backgroundColor: '#fafaf9',
  android: {
    backgroundColor: '#fafaf9',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: '#fafaf9',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
