import Taro from '@tarojs/taro'

export interface StoragePort {
  get(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

export const miniStorage: StoragePort = {
  get(key) {
    const value = Taro.getStorageSync<string>(key)
    return typeof value === 'string' && value ? value : undefined
  },
  set(key, value) {
    Taro.setStorageSync(key, value)
  },
  remove(key) {
    Taro.removeStorageSync(key)
  }
}
