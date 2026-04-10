import Link from 'next/link';
import { ChevronRight, Code2, Globe, Server, Smartphone } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-[10%] w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-8 animate-float">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sẵn sàng cho những dự án mới</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6">
            Xin chào, tôi là <br />
            <span className="text-gradient uppercase">Lưu Đình Mác</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
            <strong>System Engineer</strong> chuyên về Hạ tầng Đám mây & Tự động hóa.
            Tôi xây dựng, tối ưu hóa và duy trì các hệ thống hạ tầng sẵn sàng cao (High Availability) cho doanh nghiệp.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link
              href="/projects"
              className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-2xl font-medium shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center group"
            >
              Xem các dự án
              <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/blog"
              className="w-full sm:w-auto px-8 py-4 glass rounded-2xl font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
            >
              Đọc Blog của tôi
            </Link>
          </div>
        </div>
      </section>

      {/* Skills Grid */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 glass rounded-3xl hover-lift">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 font-bold">
                <Code2 size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Backend Development</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Xây dựng API bảo mật, hiệu năng cao với NestJS và PostgreSQL.
              </p>
            </div>

            <div className="p-8 glass rounded-3xl hover-lift">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500 mb-6 font-bold">
                <Smartphone size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Frontend Mastery</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Tạo ra các giao diện người dùng sống động với Next.js và Tailwind CSS.
              </p>
            </div>

            <div className="p-8 glass rounded-3xl hover-lift">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 mb-6 font-bold">
                <Server size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Cloud Infrastructure</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Quản lý hệ thống máy chủ và hạ tầng Docker ổn định cho dự án.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
