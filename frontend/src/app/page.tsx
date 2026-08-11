import { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BlogContent from '@/features/posts/components/BlogContent';

// Modular Services
import { postService } from '@/features/posts/services/postService';
import { categoryService as catApi } from '@/features/categories/services/categoryService';
import { seriesService } from '@/features/series/services/seriesService';
import { settingService } from '@/features/settings/services/settingService';

export const metadata: Metadata = {
  title: 'Blog chia sẻ Kiến thức | Lưu Đình Mác',
  description: 'Hành trình từ System Engineer đến Cloud & DevOps. Chia sẻ kinh nghiệm thực chiến về hệ thống, hạ tầng và công nghệ phần mềm.',
  openGraph: {
    title: 'Blog chia sẻ Kiến thức | Lưu Đình Mác',
    description: 'Hành trình từ System Engineer đến Cloud & DevOps. Chia sẻ kinh nghiệm thực chiến về hệ thống, hạ tầng và công nghệ phần mềm.',
    type: 'website',
  },
};

export const revalidate = 300; // Enable 5-minute Incremental Static Regeneration (ISR)

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : '';
  const category = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : '';
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) || 1 : 1;

  let initialPosts: any = { items: [], total: 0, limit: 12, page: 1 };
  let initialCategories: any[] = [];
  let initialSeries: any[] = [];
  let initialSettings: Record<string, string> = {};

  try {
    const [postsData, catsData, seriesData, settingsData] = await Promise.all([
      postService.getAll({ q, category, limit: 12, page }).catch(() => null),
      catApi.getAll().catch(() => []),
      seriesService.getAll().catch(() => []),
      settingService.getPublicSettings().catch(() => ({})),
    ]);

    if (postsData) initialPosts = postsData;
    if (catsData) initialCategories = catsData;
    if (seriesData) initialSeries = seriesData;
    if (settingsData) initialSettings = settingsData;
  } catch (error) {
    console.error('Failed to pre-fetch homepage data on server:', error);
  }

  const initialMeta = {
    total: initialPosts.total || 0,
    limit: initialPosts.limit || 12,
    page: initialPosts.page || 1,
  };

  const slicedSeries = Array.isArray(initialSeries) ? initialSeries.slice(0, 5) : [];

  return (
    <Suspense fallback={
      <div className="min-h-screen pt-40 text-center">
        <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Đang tải dữ liệu...</p>
      </div>
    }>
      <BlogContent 
        initialPosts={initialPosts.items || []}
        initialMeta={initialMeta}
        initialCategories={initialCategories}
        initialSeries={slicedSeries}
        initialSettings={initialSettings}
      />
    </Suspense>
  );
}

