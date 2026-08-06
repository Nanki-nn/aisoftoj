declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    TARO_ENV: 'h5' | 'weapp';
    TARO_APP_API_BASE_URL?: string;
  }
}
