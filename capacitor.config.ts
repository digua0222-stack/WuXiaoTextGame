import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wuxia.textgame',
  appName: '武侠文字游戏',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  }
};

export default config;
