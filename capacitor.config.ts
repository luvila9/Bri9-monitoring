import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aplikasi.bri9', 
  appName: 'Bri9',            
  webDir: 'out',              

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,      
      backgroundColor: "#000000"  
    }
  }
};

export default config;