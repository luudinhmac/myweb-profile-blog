'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Users, Mail, Shield, Trash2, Loader2,
  Calendar, User as UserIcon, Plus, X, Key, Eye, EyeOff,
  ChevronDown, Check, AlertCircle, Menu, Home, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const { user: currentUser, isAuthenticated, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [resetModal, setResetModal] = useState<{ open: boolean; userId: number | null; username: string }>({ open: false, userId: null, username: '' });
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    username: '', fullname: '', email: '', password: '', role: 'editor', profession: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || currentUser?.role !== 'admin')) {
      router.push('/admin');
    }
  }, [authLoading, isAuthenticated, currentUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, { credentials: 'include' });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể tạo người dùng');
      setCreateForm({ username: '', fullname: '', email: '', password: '', role: 'editor', profession: '' });
      setShowCreateForm(false);
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Xóa tài khoản "${username}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
        method: 'DELETE', credentials: 'include'
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.message || 'Không thể xóa người dùng');
        return;
      }
      fetchUsers();
    } catch (err) {
      alert('Có lỗi xảy ra khi xóa người dùng');
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal.userId || !newPassword) return;
    setResetLoading(true);
    setResetMsg(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${resetModal.userId}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResetMsg({ type: 'success', text: 'Đã đặt lại mật khẩu thành công!' });
      setNewPassword('');
      setTimeout(() => { setResetModal({ open: false, userId: null, username: '' }); setResetMsg(null); }, 2000);
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message });
    } finally {
      setResetLoading(false);
    }
  };

  const handleChangeRole = async (id: number, role: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      fetchUsers();
    } catch (err) {
      alert('Không thể thay đổi vai trò');
    }
  };

  const menuItems = [
    { id: 'posts', label: 'Bài viết', icon: Home, href: '/admin' },
    { id: 'categories', label: 'Danh mục', icon: Shield, href: '/admin/categories' },
    { id: 'users', label: 'Người dùng', icon: Users, href: '/admin/users' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row">
      
      {/* ── Desktop Sidebar ── */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col fixed inset-y-0 z-50">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
           <Link href="/" className="text-xl font-display font-bold text-gradient">Portfolio Admin</Link>
        </div>
        <nav className="flex-grow p-4 space-y-1 mt-4">
           {menuItems.map((item) => (
             <Link key={item.id} href={item.href}
               className={cn(
                 "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                 item.id === 'users' ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
               )}>
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

      {/* ── Mobile Header ── */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-500 hover:text-primary rounded-xl">
          <Menu size={22} />
        </button>
        <span className="font-bold text-slate-800 dark:text-white">Thành viên</span>
        <button onClick={() => setShowCreateForm(true)} className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/30">
          <Plus size={20} />
        </button>
      </div>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-display font-bold text-gradient">Portfolio Admin</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => (
                <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)}
                  className={cn("w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all", item.id === 'users' ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-300")}>
                  <item.icon size={18} /><span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-grow lg:ml-64 pb-24 lg:pb-0">
        
        {/* Desktop Header */}
        <div className="hidden lg:flex sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-4 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý Người dùng</h1>
              <p className="text-xs text-slate-500">Hệ thống có {users.length} thành viên</p>
            </div>
            <button onClick={() => setShowCreateForm(true)} className="flex items-center px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all">
              <Plus size={18} className="mr-2" />Tạo người dùng
            </button>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-bold uppercase tracking-widest text-slate-400 uppercase">
                    <th className="px-6 py-4">Người dùng</th>
                    <th className="px-6 py-4">Email / Info</th>
                    <th className="px-6 py-4">Vai trò</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse"><td colSpan={4} className="px-6 py-5"><div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-full" /></td></tr>
                    ))
                  ) : users.map((u) => (
                    <tr key={u.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" /> : (u.fullname || u.username)?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{u.fullname || u.username}</p>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-600 dark:text-slate-300">{u.email || 'N/A'}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Tham gia: {new Date(u.created_at).toLocaleDateString('vi-VN')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={u.role || 'editor'}
                          disabled={u.id === currentUser?.id}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer outline-none transition-colors",
                            u.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700",
                            u.id === currentUser?.id && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button onClick={() => setResetModal({ open: true, userId: u.id, username: u.username })} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg"><Key size={16} /></button>
                          <button onClick={() => handleDelete(u.id, u.username)} disabled={u.id === currentUser?.id} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-20"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-slate-200" />)
            ) : users.map((u) => (
              <div key={u.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="flex items-center space-x-3 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-lg">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-2xl object-cover" /> : (u.fullname || u.username)?.[0]?.toUpperCase()}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{u.fullname || u.username}</p>
                      <p className="text-xs text-slate-400">@{u.username} • {u.role}</p>
                   </div>
                   <div className={cn("w-2 h-2 rounded-full absolute top-4 right-4", u.role === 'admin' ? "bg-amber-400" : "bg-blue-400")} />
                </div>
                <div className="text-xs text-slate-500 mb-4 flex flex-col space-y-1">
                   <div className="flex items-center"><Mail size={12} className="mr-2" />{u.email || 'Chưa cập nhật email'}</div>
                   <div className="flex items-center"><Calendar size={12} className="mr-2" />Tham gia: {new Date(u.created_at).toLocaleDateString('vi-VN')}</div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                   <select
                      value={u.role || 'editor'}
                      disabled={u.id === currentUser?.id}
                      onChange={(e) => handleChangeRole(u.id, e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-1 px-3 text-[10px] font-bold uppercase tracking-wider"
                   >
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                   </select>
                   <div className="flex items-center space-x-2">
                      <button onClick={() => setResetModal({ open: true, userId: u.id, username: u.username })} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg"><Key size={16} /></button>
                      <button onClick={() => handleDelete(u.id, u.username)} disabled={u.id === currentUser?.id} className="p-2 text-red-500 bg-red-50 rounded-lg disabled:opacity-20"><Trash2 size={16} /></button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-around">
          <Link href="/admin" className="flex flex-col items-center p-2 text-slate-400 hover:text-primary">
            <Home size={22} /><span className="text-[10px] font-bold mt-1">Sổ bài</span>
          </Link>
          <Link href="/admin/users" className="flex flex-col items-center p-2 text-primary">
            <Users size={22} /><span className="text-[10px] font-bold mt-1">Bạn bè</span>
          </Link>
          <button onClick={logout} className="flex flex-col items-center p-2 text-red-400">
            <LogOut size={22} /><span className="text-[10px] font-bold mt-1">Thoát</span>
          </button>
      </nav>

      {/* Create/Reset Modals (Vẫn giữ nguyên UI cũ nhưng tối ưu Padding) */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-6 md:p-8 max-h-[90vh] overflow-y-auto">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tạo tài khoản</h2>
                <button onClick={() => setShowCreateForm(false)} className="p-2 text-slate-400"><X size={20} /></button>
             </div>
             {createError && (
              <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-2xl mb-6 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input required placeholder="Tên đăng nhập" value={createForm.username} onChange={e => setCreateForm({...createForm, username: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none" />
                  <input placeholder="Họ và tên" value={createForm.fullname} onChange={e => setCreateForm({...createForm, fullname: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none" />
                </div>
                <input required type="email" placeholder="Email (nếu có)" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none" />
                <input required type="password" placeholder="Mật khẩu" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none" />
                <button type="submit" disabled={createLoading} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/30">
                   {createLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Tạo ngay'}
                </button>
            </form>
          </div>
        </div>
      )}

      {resetModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl">
             <h2 className="text-xl font-bold mb-2">Đặt lại mật khẩu</h2>
             <p className="text-xs text-slate-500 mb-6 font-medium">Tài khoản: @{resetModal.username}</p>
             {resetMsg && <div className={cn("p-4 rounded-2xl mb-4 text-xs font-bold", resetMsg.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{resetMsg.text}</div>}
             <div className="relative mb-6">
                <input type={showNewPass ? 'text' : 'password'} placeholder="Mật khẩu mới (8+ ký tự)" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none" />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                   {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
             </div>
             <div className="flex space-x-3">
                <button onClick={() => setResetModal({open: false, userId: null, username: ''})} className="flex-1 py-3 text-slate-500 font-bold text-sm">Hủy</button>
                <button onClick={handleResetPassword} disabled={resetLoading || !newPassword} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30">
                   {resetLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Xác nhận'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
