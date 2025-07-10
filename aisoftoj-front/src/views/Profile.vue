<template>
  <div class="profile-container">
    <el-card>
      <template #header>
        <div class="header">
          <h2>个人中心</h2>
          <el-button @click="$router.push('/')">返回题库</el-button>
        </div>
      </template>
      
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" v-if="form.id" v-loading="loading">
        <el-form-item label="用户ID">
          <el-input v-model="form.id" disabled />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" disabled />
        </el-form-item>
        <el-form-item label="头像">
          <div class="avatar-container">
            <div class="avatar-preview">
              <el-avatar 
                :size="80" 
                :src="avatarUrl" 
                :icon="!avatarUrl ? 'el-icon-user' : ''"
                class="avatar-image"
              />
              <div class="avatar-overlay" v-if="uploading">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
            </div>
            <div class="avatar-actions">
              <el-upload
                ref="uploadRef"
                :show-file-list="false"
                :before-upload="beforeAvatarUpload"
                :http-request="customUpload"
                accept="image/*"
                class="avatar-uploader"
              >
                <el-button size="small" type="primary" :loading="uploading">上传头像</el-button>
              </el-upload>
              <el-button 
                size="small" 
                @click="removeAvatar" 
                v-if="avatarUrl"
                style="margin-top: 10px;"
              >
                移除头像
              </el-button>
            </div>
          </div>
          <el-input v-model="form.avatar" placeholder="或直接输入头像URL" style="margin-top: 10px;" />
          <div class="avatar-tips">
            <el-text size="small" type="info">支持 JPG、PNG、GIF 格式，文件大小不超过 2MB</el-text>
          </div>
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="角色">
          <el-tag :type="form.role === 1 ? 'danger' : 'success'">
            {{ form.role === 1 ? '管理员' : '普通用户' }}
          </el-tag>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onUpdate" :loading="updating">保存修改</el-button>
          <el-button @click="logout">退出登录</el-button>
        </el-form-item>
      </el-form>
      
      <el-empty v-else description="用户信息加载中..." />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getProfile, updateProfile, uploadAvatar } from '../api/user'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const router = useRouter()
const formRef = ref()
const uploadRef = ref()
const form = ref({})
const loading = ref(false)
const updating = ref(false)
const uploading = ref(false)

const rules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 计算头像URL
const avatarUrl = computed(() => {
  return form.value.avatar || ''
})

// 头像上传前的验证
const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('头像只能是图片格式!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB!')
    return false
  }
  return true
}

// 自定义上传
const customUpload = async (options) => {
  try {
    uploading.value = true
    const response = await uploadAvatar(options.file)
    
    if (response.data.code === 200) {
      form.value.avatar = response.data.data
      ElMessage.success('头像上传成功')
    } else {
      ElMessage.error('头像上传失败：' + response.data.message)
    }
  } catch (error) {
    ElMessage.error('头像上传失败：' + (error.response?.data?.message || error.message || '网络错误'))
  } finally {
    uploading.value = false
  }
}

// 移除头像
const removeAvatar = () => {
  form.value.avatar = ''
  ElMessage.success('头像已移除')
}

const loadProfile = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user || !user.id) {
      ElMessage.error('请先登录')
      router.push('/login')
      return
    }
    
    loading.value = true
    const res = await getProfile(user.id)
    form.value = res.data
  } catch (e) {
    ElMessage.error('获取用户信息失败：' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

const onUpdate = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    updating.value = true
    
    await updateProfile(form.value)
    ElMessage.success('更新成功')
    // 更新本地存储的用户信息
    const user = JSON.parse(localStorage.getItem('user'))
    user.nickname = form.value.nickname
    user.email = form.value.email
    user.phone = form.value.phone
    user.avatar = form.value.avatar
    localStorage.setItem('user', JSON.stringify(user))
  } catch (e) {
    ElMessage.error('更新失败：' + (e.response?.data?.message || e.message))
  } finally {
    updating.value = false
  }
}

const logout = () => {
  localStorage.removeItem('user')
  ElMessage.success('已退出登录')
  router.push('/login')
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.profile-container {
  max-width: 600px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0;
}

.avatar-container {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.avatar-preview {
  position: relative;
  display: inline-block;
}

.avatar-image {
  border: 2px solid #e4e7ed;
  border-radius: 50%;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.avatar-uploader {
  display: inline-block;
}

.avatar-tips {
  margin-top: 8px;
}
</style> 