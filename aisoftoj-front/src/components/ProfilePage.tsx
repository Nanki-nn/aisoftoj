import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Trophy,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Clock,
  Edit,
  Camera,
  ArrowLeft,
  Star,
  BarChart3,
  Activity
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from './BrandLogo';
import { User as UserType, UserStats } from '../types/user';

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, updateUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '');
  const [editForm, setEditForm] = useState({
    nickname: user?.nickname || '',
    phone: user?.phone || '',
    email: user?.email || ''
  });

  // 预设头像列表
  const avatarOptions = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Daisy',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Frank',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Grace',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Henry',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Isabelle',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Kate',
  ];

  // 模拟用户统计数据
  const userStats: UserStats = {
    totalExams: user?.totalExams || 0,
    totalQuestions: user?.totalQuestions || 0,
    correctAnswers: user?.correctAnswers || 0,
    accuracy: user?.accuracy || 0,
    studyDays: user?.studyDays || 0,
    level: user?.level || 'beginner',
    points: user?.points || 0,
    recentActivity: [
      { date: '2025-10-03', type: 'exam', subject: '系统架构设计师', score: 85 },
      { date: '2025-10-02', type: 'practice', subject: '数据库系统工程师', score: 92 },
      { date: '2025-10-01', type: 'exam', subject: '软件设计师', score: 78 },
      { date: '2025-09-30', type: 'practice', subject: '系统架构设计师', score: 88 },
    ],
    weakSubjects: [
      { subject: '系统设计', accuracy: 68 },
      { subject: '数据库理论', accuracy: 72 },
      { subject: '网络安全', accuracy: 75 }
    ],
    achievements: [
      { title: '新手上路', description: '完成第一次练习', unlockedDate: '2024-03-15', icon: '🎯' },
      { title: '连续学习7天', description: '坚持学习一周', unlockedDate: '2024-03-22', icon: '📚' },
      { title: '首次满分', description: '第一次获得满分', unlockedDate: '2024-04-10', icon: '🏆' },
      { title: '刷题达人', description: '累计答题超过1000道', unlockedDate: '2024-08-15', icon: '💪' }
    ]
  };

  const handleSaveProfile = () => {
    if (user) {
      updateUser({
        nickname: editForm.nickname,
        phone: editForm.phone,
        email: editForm.email
      });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      nickname: user?.nickname || '',
      phone: user?.phone || '',
      email: user?.email || ''
    });
    setIsEditing(false);
  };

  const handleAvatarChange = () => {
    if (user && selectedAvatar) {
      updateUser({ avatar: selectedAvatar });
      setShowAvatarDialog(false);
    }
  };

  const handleOpenAvatarDialog = () => {
    setSelectedAvatar(user?.avatar || '');
    setShowAvatarDialog(true);
  };

  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'beginner': return { name: '初学者', color: 'bg-green-500', progress: 25 };
      case 'intermediate': return { name: '进阶者', color: 'bg-blue-500', progress: 50 };
      case 'advanced': return { name: '高级者', color: 'bg-purple-500', progress: 75 };
      case 'expert': return { name: '专家', color: 'bg-orange-500', progress: 100 };
      default: return { name: '初学者', color: 'bg-green-500', progress: 25 };
    }
  };

  const levelInfo = getLevelInfo(user?.level || 'beginner');

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航 */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <span className="text-slate-300">|</span>
              <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-1 text-slate-600">
                首页
              </Button>
            </div>
            <h1 className="text-xl text-slate-800">个人中心</h1>
            <Button variant="outline" onClick={logout}>
              退出登录
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 用户基本信息卡片 */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border border-slate-200/50">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                      {user.nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleOpenAvatarDialog}
                    className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                  >
                    <Camera className="w-3 h-3" />
                  </Button>
                </div>
                <Badge className={`${levelInfo.color} text-white`}>
                  {levelInfo.name}
                </Badge>
              </div>

              <div className="flex-1">
                {!isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl text-slate-800">{user.nickname}</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        编辑资料
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600">用户名：</span>
                        <span className="text-slate-800">{user.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600">邮箱：</span>
                        <span className="text-slate-800">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600">手机：</span>
                        <span className="text-slate-800">{user.phone || '未绑定'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600">加入时间：</span>
                        <span className="text-slate-800">{user.joinDate}</span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">学习等级进度</span>
                        <span className="text-sm text-slate-800">{user.points} 积分</span>
                      </div>
                      <Progress value={levelInfo.progress} className="h-2" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-2xl text-slate-800">编辑个人资料</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nickname">昵称</Label>
                        <Input
                          id="nickname"
                          value={editForm.nickname}
                          onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">手机号码</Label>
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="email">邮箱地址</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile}>保存</Button>
                      <Button variant="outline" onClick={handleCancelEdit}>取消</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 统计数据 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2" />
              <h3 className="mb-1">总答题数</h3>
              <p className="text-2xl">{userStats.totalQuestions}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2" />
              <h3 className="mb-1">正确率</h3>
              <p className="text-2xl">{userStats.accuracy}%</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2" />
              <h3 className="mb-1">考试次数</h3>
              <p className="text-2xl">{userStats.totalExams}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2" />
              <h3 className="mb-1">学习天数</h3>
              <p className="text-2xl">{userStats.studyDays}</p>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              学习记录
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              能力分析
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              成就徽章
            </TabsTrigger>
          </TabsList>

          {/* 学习记录 */}
          <TabsContent value="activity">
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  最近学习记录
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userStats.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          activity.type === 'exam' ? 'bg-blue-500' : 'bg-green-500'
                        }`} />
                        <div>
                          <p className="text-slate-800">{activity.subject}</p>
                          <p className="text-sm text-slate-500">
                            {activity.type === 'exam' ? '正式考试' : '练习模式'} · {activity.date}
                          </p>
                        </div>
                      </div>
                      {activity.score && (
                        <Badge variant={activity.score >= 80 ? 'default' : 'secondary'}>
                          {activity.score}分
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 能力分析 */}
          <TabsContent value="analysis">
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  薄弱知识点分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userStats.weakSubjects.map((subject, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-800">{subject.subject}</span>
                        <span className="text-sm text-slate-600">{subject.accuracy}%</span>
                      </div>
                      <Progress value={subject.accuracy} className="h-2" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-slate-800 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    提升建议
                  </h4>
                  <p className="text-sm text-slate-600">
                    建议重点复习系统设计和数据库理论相关知识点，可以通过专项练习来提升薄弱环节。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 成就徽章 */}
          <TabsContent value="achievements">
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  成就徽章
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userStats.achievements.map((achievement, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="text-3xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <h4 className="text-slate-800 mb-1">{achievement.title}</h4>
                        <p className="text-sm text-slate-600 mb-2">{achievement.description}</p>
                        <p className="text-xs text-slate-500">获得时间：{achievement.unlockedDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 头像选择对话框 */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>选择头像</DialogTitle>
            <DialogDescription>
              选择一个你喜欢的头像
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            {avatarOptions.map((avatarUrl, index) => (
              <div
                key={index}
                className={`cursor-pointer rounded-lg border-2 p-2 transition-all hover:scale-105 ${
                  selectedAvatar === avatarUrl
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedAvatar(avatarUrl)}
              >
                <Avatar className="w-full aspect-square">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-slate-100">?</AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAvatarChange}>
              确认更换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}