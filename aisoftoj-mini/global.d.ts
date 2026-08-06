declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    TARO_APP_API_BASE_URL?: string;
  }
}
