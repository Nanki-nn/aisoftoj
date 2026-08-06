import { Text, View } from '@tarojs/components'

export default function WrongPage() {
  return (
    <View className='page-shell'>
      <Text className='eyebrow'>复盘</Text>
      <Text className='page-title'>错题本</Text>
      <Text className='page-note'>按错误次数和最近作答整理，帮助你把精力放在最薄弱的位置。</Text>
      <View className='empty-state'>
        <Text className='empty-state__mark'>NEXT</Text>
        <Text className='empty-state__title'>完成首组练习后生成</Text>
        <Text className='empty-state__body'>错题接口将在完整纵切后接入，这里不会使用模拟学习数据。</Text>
      </View>
    </View>
  )
}
