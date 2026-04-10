'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  BarChart3, 
  FileText, 
  Layout, 
  Plus, 
  Settings, 
  Users, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  Search,
  Loader2,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [postsRes, catsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, { credentials: 'include' })
      ]);
      
      const postsData = await postsRes.json();
      const catsData = await catsRes.json();
      
      setPosts(Array.isArray(postsData) ? postsData : []);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Không thể xóa bài viết');
      
      // Refresh list
      fetchData();
    } catch (err) {
      alert('Có lỗi xảy ra khi xóa bài viết');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar - Same as before */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col fixed inset-y-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <Link href="/" className="text-xl font-display font-bold text-gradient">
            Portfolio Admin
          </Link>
        </div>
        
        <nav className="flex-grow p-4 space-y-2 mt-4">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'overview' ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <BarChart3 size={18} />
            <span>Tổng quan</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'posts' ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <FileText size={18} />
            <span>Bài viết</span>
          </button>

          <button 
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Layout size={18} />
            <span>Danh mục</span>
          </button>

          <button 
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Users size={18} />
            <span>Người dùng</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Settings size={18} />
            <span>Cài đặt</span>
          </button>
          
          <button 
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow lg:ml-64 p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý bài viết</h1>
            <p className="text-sm text-slate-500">Xem, tạo và chỉnh sửa các bài viết trên Blog của bạn.</p>
          </div>

          <div className="flex items-center space-x-3">
             <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm bài viết..."
                  className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
             </div>
             <Link 
              href="/admin/posts/new" 
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium shadow-lg shadow-primary/20 hover:opacity-90 flex items-center"
             >
                <Plus size={18} className="mr-2" />
                Viết bài mới
             </Link>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Tổng bài viết', count: posts.length, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Tổng lượt xem', count: '0', icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { label: 'Danh mục', count: categories.length, icon: Layout, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
              { label: 'Bình luận', count: '0', icon: MessageCircle, color: 'text-pink-500', bg: 'bg-pink-500/10' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2 rounded-lg", stat.bg)}>
                    <stat.icon className={stat.color} size={20} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.count}</h3>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
        </div>

        {/* Posts Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Tiêu đề bài viết</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Danh mục</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Ngày tạo</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : posts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                       Chưa có bài viết nào được tạo. Hãy bắt đầu chia sẻ kiến thức của bạn ngay!
                    </td>
                  </tr>
                ) : posts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                      {post.title}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold uppercase text-slate-500">
                        {post.Category?.name || 'Chưa phân loại'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          className="p-2 text-slate-400 hover:text-primary transition-colors"
                          onClick={() => alert('Chức năng sửa sắp ra mắt')}
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-destructive transition-colors"
                          onClick={() => handleDelete(post.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// Separate icon for Comments mapping
function MessageCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
