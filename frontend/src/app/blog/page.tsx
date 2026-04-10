'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, ChevronRight, Search, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BlogListPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`);
        const data = await response.json();
        setPosts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-32 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 space-y-6 md:space-y-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-4">
              Blog & Kiến thức
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Nơi chia sẻ những kinh nghiệm thực tế, các bài hướng dẫn kỹ thuật và góc nhìn về công nghệ.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all outline-none"
              placeholder="Tìm kiếm bài viết..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass rounded-[2rem] p-6 h-96 animate-pulse" />
            ))}
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => (
              <article 
                key={post.id} 
                className="group glass rounded-[2.5rem] overflow-hidden hover-lift flex flex-col h-full"
              >
                <div className="aspect-[16/10] overflow-hidden relative">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full text-xs font-bold text-primary">
                      {post.Category?.name || 'Chưa phân loại'}
                    </span>
                  </div>
                  {/* Placeholder for images if not exists */}
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/20 flex items-center justify-center">
                    <Tag size={48} className="text-primary/20" />
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <span className="flex items-center">
                      <Calendar size={14} className="mr-1.5" />
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="flex items-center">
                      <Clock size={14} className="mr-1.5" />
                      5 phút đọc
                    </span>
                  </div>

                  <h2 className="text-xl font-bold mb-4 line-clamp-2 text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  
                  <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-6 flex-grow">
                    {post.content?.replace(/<[^>]*>/g, '') || 'Tiếp tục đọc để khám phá thêm nội dung chi tiết của bài viết này...'}
                  </p>

                  <Link 
                    href={`/blog/${post.id}`}
                    className="inline-flex items-center text-sm font-bold text-primary group-hover:underline"
                  >
                    Đọc tiếp
                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Không tìm thấy bài viết</h3>
            <p className="text-slate-500">Hãy thử tìm kiếm với từ khóa khác.</p>
          </div>
        )}
      </div>
    </div>
  );
}
