import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jesper.svampkartan',
  appName: 'Svampkartan',
  webDir: 'out',
  server: {
    androidScheme: 'capacitor'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#22c55e",
      androidSplashResourceName: "splash"
    }
  }
};

// Force resync after icon changes

export default config;
