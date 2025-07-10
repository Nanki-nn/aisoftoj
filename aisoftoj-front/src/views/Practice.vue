<template>
  <div class="practice-container">
    <el-card v-if="question">
      <template #header>
        <div class="header">
          <h3>刷题练习</h3>
          <el-button @click="$router.push('/')">返回题库</el-button>
        </div>
      </template>
      
      <div class="question-content">
        <h4>题目：</h4>
        <p>{{ question.content }}</p>
        
        <div v-if="question.options" class="options">
          <h4>选项：</h4>
          <el-radio-group v-model="answer" class="radio-group">
            <el-radio v-for="(opt, key) in optionsObj" :key="key" :label="key" class="radio-item">
              {{ key }}. {{ opt }}
            </el-radio>
          </el-radio-group>
        </div>
        
        <div class="actions">
          <el-button type="primary" @click="submitAnswer" :disabled="!answer">提交答案</el-button>
          <el-button @click="nextQuestion">下一题</el-button>
        </div>
        
        <div v-if="result" class="result">
          <el-alert 
            :title="result" 
            :type="result === '回答正确！' ? 'success' : 'error'"
            show-icon
            :closable="false"
          />
          <div class="analysis">
            <h4>解析：</h4>
            <p>{{ question.analysis || '暂无解析' }}</p>
          </div>
        </div>
      </div>
    </el-card>
    
    <el-card v-else-if="loading">
      <el-empty description="题目加载中..." />
    </el-card>
    
    <el-card v-else>
      <el-empty description="题目不存在或加载失败" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { searchQuestions, getRandomQuestion } from '../api/question'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const question = ref(null)
const answer = ref('')
const result = ref('')
const optionsObj = ref({})
const loading = ref(false)

const checkLogin = () => {
  const user = localStorage.getItem('user')
  if (!user) {
    ElMessage.error('请先登录')
    router.push('/login')
    return false
  }
  return true
}

const loadQuestion = async (id) => {
  if (!checkLogin()) return
  
  loading.value = true
  try {
    const res = await searchQuestions({ page: 1, size: 1, id })
    if (res.data && res.data.length > 0) {
      question.value = res.data[0]
      optionsObj.value = question.value.options ? JSON.parse(question.value.options) : {}
      answer.value = ''
      result.value = ''
    } else {
      ElMessage.error('题目不存在')
    }
  } catch (e) {
    ElMessage.error('加载题目失败：' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

const submitAnswer = () => {
  if (answer.value === question.value.answer) {
    result.value = '回答正确！'
  } else {
    result.value = '回答错误，正确答案：' + question.value.answer
  }
}

const nextQuestion = async () => {
  if (!checkLogin()) return
  
  try {
    const res = await getRandomQuestion(question.value.categoryId)
    if (res.data) {
      router.push({ path: '/practice', query: { id: res.data.id } })
    } else {
      ElMessage.info('没有更多题目了')
    }
  } catch (e) {
    ElMessage.error('获取下一题失败：' + (e.response?.data?.message || e.message))
  }
}

onMounted(() => {
  const id = route.query.id
  if (id) {
    loadQuestion(id)
  } else {
    ElMessage.error('缺少题目ID参数')
    router.push('/')
  }
})
</script>

<style scoped>
.practice-container {
  max-width: 800px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-content {
  padding: 20px 0;
}

.options {
  margin: 20px 0;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-item {
  margin-bottom: 10px;
}

.actions {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.result {
  margin-top: 20px;
}

.analysis {
  margin-top: 15px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

h3, h4 {
  margin: 0 0 10px 0;
}
</style> 