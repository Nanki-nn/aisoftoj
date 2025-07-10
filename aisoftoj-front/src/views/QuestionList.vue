<template>
  <div class="question-list">
    <el-card>
      <template #header>
        <div class="header">
          <h2>题库列表</h2>
          <div class="controls">
            <el-select v-model="categoryId" placeholder="选择分类" @change="fetchQuestions" style="width: 150px; margin-right: 10px;">
              <el-option label="全部" :value="null" />
              <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索题目" @keyup.enter="fetchQuestions" style="width: 200px; margin-right: 10px;" />
            <el-button type="primary" @click="fetchQuestions">搜索</el-button>
            <el-button @click="$router.push('/profile')" style="margin-left: 10px;">个人中心</el-button>
            <el-button @click="logout" style="margin-left: 10px;" type="danger">退出登录</el-button>
          </div>
        </div>
      </template>
      
      <el-table :data="questions" style="width: 100%" v-loading="loading">
        <el-table-column prop="content" label="题目" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="scope">
            {{ getTypeName(scope.row.type) }}
          </template>
        </el-table-column>
        <el-table-column prop="difficulty" label="难度" width="100">
          <template #default="scope">
            <el-tag :type="getDifficultyType(scope.row.difficulty)">
              {{ getDifficultyName(scope.row.difficulty) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="doPractice(scope.row)">刷题</el-button>
            <el-button size="small" type="success" @click="getRandomQuestion(scope.row.categoryId)">随机刷题</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="questions.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无题目数据" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCategories, searchQuestions, getRandomQuestion as getRandom } from '../api/question'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const categories = ref([])
const questions = ref([])
const categoryId = ref(null)
const keyword = ref('')
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

const fetchQuestions = async () => {
  if (!checkLogin()) return
  
  loading.value = true
  try {
    const res = await searchQuestions({ categoryId: categoryId.value, keyword: keyword.value })
    questions.value = res.data || []
  } catch (e) {
    ElMessage.error('获取题目失败：' + (e.response?.data?.message || e.message))
    questions.value = []
  } finally {
    loading.value = false
  }
}

const doPractice = (question) => {
  router.push({ path: '/practice', query: { id: question.id } })
}

const getRandomQuestion = async (categoryId) => {
  if (!checkLogin()) return
  
  try {
    const res = await getRandom(categoryId)
    if (res.data) {
      router.push({ path: '/practice', query: { id: res.data.id } })
    } else {
      ElMessage.info('该分类下暂无题目')
    }
  } catch (e) {
    ElMessage.error('获取随机题目失败：' + (e.response?.data?.message || e.message))
  }
}

const logout = () => {
  localStorage.removeItem('user')
  ElMessage.success('已退出登录')
  router.push('/login')
}

const getTypeName = (type) => {
  const types = { 1: '单选', 2: '多选', 3: '判断', 4: '简答' }
  return types[type] || '未知'
}

const getDifficultyName = (difficulty) => {
  const difficulties = { 1: '简单', 2: '中等', 3: '困难' }
  return difficulties[difficulty] || '未知'
}

const getDifficultyType = (difficulty) => {
  const types = { 1: 'success', 2: 'warning', 3: 'danger' }
  return types[difficulty] || 'info'
}

onMounted(async () => {
  if (!checkLogin()) return
  
  try {
    const res = await getCategories()
    categories.value = res.data || []
    fetchQuestions()
  } catch (e) {
    ElMessage.error('获取分类失败：' + (e.response?.data?.message || e.message))
  }
})
</script>

<style scoped>
.question-list {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.controls {
  display: flex;
  align-items: center;
}

h2 {
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
}
</style> 