import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jesper.svampkartan',
  appName: 'Svampkartan',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    iosScheme: 'capacitor',
    url: undefined
  }
};

export default config;
