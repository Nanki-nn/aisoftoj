import api from './user.js'

export function getCategories() {
  return api.get('/question/categories')
}

export function searchQuestions(params) {
  return api.get('/question/search', { params })
}

export function getRandomQuestion(categoryId) {
  return api.get('/question/random', { params: { categoryId } })
}

export function getSequenceQuestions(params) {
  return api.get('/question/sequence', { params })
}

export function getSpecialQuestions(categoryId) {
  return api.get('/question/special', { params: { categoryId } })
} 