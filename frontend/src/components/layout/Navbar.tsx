'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight, LayoutDashboard as DashboardIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { name: 'Trang chủ', href: '/' },
  { name: 'Blog', href: '/blog' },
  { name: 'Dự án', href: '/projects' },
  { name: 'Khóa học', href: '/courses' },
  { name: 'Giới thiệu', href: '/about' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4",
      scrolled ? "py-3" : "py-6"
    )}>
      <div className={cn(
        "max-w-7xl mx-auto glass rounded-2xl md:rounded-[2rem] px-6 transition-all duration-300",
        scrolled ? "py-3 shadow-lg" : "py-4 bg-transparent border-transparent"
      )}>
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-display font-bold text-gradient">
            Portfolio
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white transition-colors"
              >
                {item.name}
              </Link>
            ))}
            {!loading && (
              <Link 
                href={isAuthenticated ? "/admin" : "/login"} 
                className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:opacity-90 transition-all shadow-md shadow-primary/20 flex items-center group"
              >
                {isAuthenticated ? (
                  <>
                    Dashboard
                    <DashboardIcon size={16} className="ml-1.5" />
                  </>
                ) : (
                  <>
                    Quản trị
                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Link>
            )}
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden p-2 text-slate-600 dark:text-slate-300"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute top-24 left-4 right-4 glass rounded-3xl p-6 transition-all duration-300 origin-top shadow-2xl",
        isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
      )}>
        <div className="flex flex-col space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-lg font-medium text-slate-700 dark:text-slate-200"
              onClick={() => setIsOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          {!loading && (
            <Link 
              href={isAuthenticated ? "/admin" : "/login"} 
              className="w-full py-4 bg-primary text-white rounded-2xl text-center font-medium shadow-lg shadow-primary/20 flex items-center justify-center"
              onClick={() => setIsOpen(false)}
            >
              {isAuthenticated ? (
                <>
                  <DashboardIcon size={20} className="mr-2" />
                  Vào Dashboard Quản trị
                </>
              ) : (
                'Đăng nhập Quản trị'
              )}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
