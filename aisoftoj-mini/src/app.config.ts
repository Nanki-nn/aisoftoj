export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/exam-config/index',
    'pages/session/index',
    'pages/result/index',
    'pages/history/index',
    'pages/privacy/index',
    'pages/home/index',
    'pages/papers/index',
    'pages/wrong/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f5f7f2',
    navigationBarTitleText: '知构软考',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f7f2'
  },
  tabBar: {
    color: '#66746d',
    selectedColor: '#166b5d',
    backgroundColor: '#fbfcf8',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/papers/index', text: '试卷' },
      { pagePath: 'pages/wrong/index', text: '错题' },
      { pagePath: 'pages/profile/index', text: '我的' }
    ]
  }
})
