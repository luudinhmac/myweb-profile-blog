'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Tag, Layout } from 'lucide-react';

export default function NewPostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category_id: '',
    tags: '',
    is_pinned: false
  });

  useEffect(() => {
    // Fetch categories for dropdown
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          category_id: parseInt(formData.category_id)
        }),
      });

      if (!response.ok) throw new Error('Không thể tạo bài viết');

      router.push('/admin');
      router.refresh();
    } catch (err) {
      alert('Có lỗi xảy ra khi tạo bài viết');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href="/admin" 
              className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary transition-all shadow-sm"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Viết bài mới</h1>
              <p className="text-sm text-slate-500">Chia sẻ kiến thức và kinh nghiệm của bạn.</p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center"
          >
            {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            Xuất bản ngay
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Editor Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-8 rounded-[2.5rem]">
               <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                    Tiêu đề bài viết
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập tiêu đề ấn tượng..."
                    className="w-full px-6 py-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-lg font-bold"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                    Nội dung bài viết (Hỗ trợ HTML)
                  </label>
                  <textarea 
                    rows={15}
                    placeholder="Viết nội dung bài viết tại đây..."
                    className="w-full px-6 py-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
               </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
             <div className="glass p-8 rounded-[2.5rem]">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                   <Layout size={18} className="mr-2 text-primary" />
                   Cấu hình bài viết
                </h3>

                <div className="space-y-6">
                   <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Danh mục
                      </label>
                      <select 
                        className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm appearance-none"
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      >
                         <option value="">Chọn danh mục</option>
                         {categories.map(cat => (
                           <option key={cat.id} value={cat.id}>{cat.name}</option>
                         ))}
                      </select>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Thẻ (Tags)
                      </label>
                      <div className="relative">
                        <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="tag1, tag2..."
                          className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        />
                      </div>
                   </div>

                   <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Ghim bài viết</span>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-primary cursor-pointer"
                        checked={formData.is_pinned}
                        onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                      />
                   </div>
                </div>
             </div>

             <div className="glass p-8 rounded-[2.5rem]">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                   <ImageIcon size={18} className="mr-2 text-primary" />
                   Ảnh bìa
                </h3>
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={32} className="mb-2" />
                    <span className="text-xs">Chức năng upload sắp ra mắt</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
