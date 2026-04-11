'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  ArrowLeft, Plus, Trash2, Layout, Loader2, FileText, Search, Menu, Home, LogOut, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CategoriesPage() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newCategory.trim() })
      });
      if (!res.ok) throw new Error();
      setNewCategory('');
      fetchCategories();
    } catch {
      alert('Lỗi: Danh mục có thể đã tồn tại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error();
      fetchCategories();
    } catch {
      alert('Có lỗi xảy ra khi xóa danh mục');
    }
  };

  const menuItems = [
    { id: 'posts', label: 'Bài viết', icon: Home, href: '/admin' },
    { id: 'categories', label: 'Danh mục', icon: Layout, href: '/admin/categories' },
    ...(user?.role === 'admin' ? [{ id: 'users', label: 'Người dùng', icon: Users, href: '/admin/users' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col fixed inset-y-0 z-50">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <Link href="/" className="text-xl font-display font-bold text-gradient">Portfolio Admin</Link>
        </div>
        <nav className="flex-grow p-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <Link key={item.id} href={item.href}
              className={cn("w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all transition-colors", item.id === 'categories' ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}>
              <item.icon size={18} /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut size={18} /><span>Đăng xuất</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow lg:ml-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
           <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-500"><Menu size={22} /></button>
           <span className="font-bold text-slate-800 dark:text-white">Danh mục</span>
           <div className="w-9" />
        </div>

        {/* Sidebar Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
               <div className="p-5 border-b flex items-center justify-between">
                  <span className="font-display font-bold text-gradient">Portfolio Admin</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-400"><Plus className="rotate-45" size={20} /></button>
               </div>
               <nav className="p-4 space-y-1">
                  {menuItems.map(item => (
                    <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)}
                      className={cn("w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all", item.id === 'categories' ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-300")}>
                      <item.icon size={18} /><span>{item.label}</span>
                    </Link>
                  ))}
               </nav>
            </aside>
          </div>
        )}

        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <header className="hidden md:flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Quản lý danh mục</h1>
              <p className="text-sm text-slate-500">Tổ chức các bài viết của bạn.</p>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Form */}
            <div className="md:col-span-1">
               <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-24">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Thêm danh mục mới</h3>
                  <form onSubmit={handleAddCategory} className="space-y-4">
                     <input type="text" placeholder="Tên danh mục..." value={newCategory} onChange={e => setNewCategory(e.target.value)} required
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none" />
                     <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50">
                        {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Lưu danh mục'}
                     </button>
                  </form>
               </div>
            </div>

            {/* List */}
            <div className="md:col-span-2">
               <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                     <h3 className="text-sm font-bold">Danh sách hiện tại</h3>
                     <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-500 tracking-widest">{categories.length} DANH MỤC</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {loading ? (
                       [...Array(3)].map((_, i) => <div key={i} className="p-6 h-16 animate-pulse" />)
                     ) : categories.map(cat => (
                       <div key={cat.id} className="p-4 md:p-6 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center space-x-3">
                             <div className="p-2.5 bg-primary/5 rounded-xl text-primary"><FileText size={16} /></div>
                             <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{cat.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium">ID: #{cat.id} • {new Date(cat.created_at).toLocaleDateString('vi-VN')}</p>
                             </div>
                          </div>
                          <button onClick={() => handleDelete(cat.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-100 md:opacity-0 group-hover:opacity-100">
                             <Trash2 size={18} />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex justify-around">
          <Link href="/admin" className="flex flex-col items-center p-2 text-slate-400">
            <Home size={22} /><span className="text-[10px] font-bold mt-1">Bài viết</span>
          </Link>
          <Link href="/admin/categories" className="flex flex-col items-center p-2 text-primary">
            <Layout size={22} /><span className="text-[10px] font-bold mt-1">Danh mục</span>
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin/users" className="flex flex-col items-center p-2 text-slate-400">
              <Users size={22} /><span className="text-[10px] font-bold mt-1">Thành viên</span>
            </Link>
          )}
      </nav>
    </div>
  );
}
