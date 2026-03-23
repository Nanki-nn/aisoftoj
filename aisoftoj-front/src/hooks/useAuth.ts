import { useState, useCallback } from 'react';
import { User, LoginForm, RegisterForm } from '../types/user';

// 模拟用户数据
const mockUser: User = {
  id: 'user_001',
  username: 'student123',
  email: 'student@example.com',
  nickname: '软考小能手',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=student123',
  phone: '138****8888',
  joinDate: '2024-03-15',
  lastLoginDate: '2025-10-03',
  totalExams: 45,
  totalQuestions: 1250,
  correctAnswers: 1050,
  accuracy: 84,
  studyDays: 128,
  level: 'intermediate',
  points: 2580,
  badges: ['新手上路', '连续学习7天', '首次满分', '刷题达人']
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (loginData: LoginForm): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟登录验证
      if (loginData.email === 'student@example.com' && loginData.password === '123456') {
        setUser(mockUser);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify(mockUser));
        return true;
      } else {
        setError('邮箱或密码错误');
        return false;
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (registerData: RegisterForm): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 模拟注册验证
      if (registerData.email === 'existing@example.com') {
        setError('该邮箱已被注册');
        return false;
      }

      // 创建新用户
      const newUser: User = {
        id: `user_${Date.now()}`,
        username: registerData.username,
        email: registerData.email,
        nickname: registerData.nickname,
        phone: registerData.phone,
        joinDate: new Date().toISOString().split('T')[0],
        lastLoginDate: new Date().toISOString().split('T')[0],
        totalExams: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        accuracy: 0,
        studyDays: 0,
        level: 'beginner',
        points: 0,
        badges: ['新手上路']
      };

      setUser(newUser);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', JSON.stringify(newUser));
      return true;
    } catch (err) {
      setError('注册失败，请稍后重试');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
  }, []);

  const updateUser = useCallback((updatedData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }, [user]);

  const checkAuthStatus = useCallback(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');
    
    if (isLoggedIn === 'true' && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
      }
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser,
    checkAuthStatus,
    isAuthenticated: !!user
  };
}