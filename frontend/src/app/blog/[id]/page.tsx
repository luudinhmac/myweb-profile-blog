'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Calendar, Clock, ChevronLeft, Tag, Share2, MessageCircle } from 'lucide-react';

export default function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${id}`);
        const data = await response.json();
        setPost(data);
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (loading) {
    return (
      <div className="pt-32 pb-20 px-4 min-h-screen max-w-4xl mx-auto">
        <div className="h-10 w-48 bg-slate-100 dark:bg-slate-900 rounded-full animate-pulse mb-8" />
        <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] animate-pulse mb-12" />
        <div className="space-y-4">
          <div className="h-6 w-full bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
          <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pt-48 pb-20 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Bài viết không tồn tại</h2>
        <Link href="/blog" className="text-primary hover:underline">Quay lại trang blog</Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4 min-h-screen">
      <article className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link 
          href="/blog" 
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-12 group"
        >
          <ChevronLeft size={16} className="mr-1.5 group-hover:-translate-x-1 transition-transform" />
          Tất cả bài viết
        </Link>

        {/* Post Header */}
        <header className="mb-12">
          <div className="flex items-center space-x-2 mb-6">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
              {post.Category?.name || 'Kỹ thuật'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-sm text-slate-500">{new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-slate-900 dark:text-white mb-8 leading-[1.1]">
            {post.title}
          </h1>

          <div className="flex items-center justify-between py-6 border-y border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white font-bold">
                {post.User?.fullname?.[0] || 'A'}
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{post.User?.fullname || 'Administrator'}</p>
                <p className="text-xs text-slate-500">System Engineer & Blogger</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button className="p-2.5 glass rounded-full hover:text-primary transition-colors">
                <Share2 size={18} />
              </button>
              <button className="p-2.5 glass rounded-full hover:text-primary transition-colors">
                <MessageCircle size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Featured Image Replacement */}
        <div className="w-full h-[400px] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-[2.5rem] mb-12 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
           <Tag size={80} className="text-primary/10 animate-pulse" />
        </div>

        {/* Post Content */}
        <div 
          className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Footer info */}
        <footer className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-sm font-bold text-slate-900 dark:text-white mr-2 self-center">Tags:</span>
            {['TypeScript', 'NestJS', 'Next.js', 'System Engineering'].map(tag => (
              <span key={tag} className="px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-full text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        </footer>
      </article>
    </div>
  );
}
