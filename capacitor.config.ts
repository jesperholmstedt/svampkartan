import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jesper.svampkartan',
  appName: 'Svampkartan',
  webDir: 'out',
  server: {
    androidScheme: 'capacitor'
  }
};

// Force resync after icon changes

export default config;
