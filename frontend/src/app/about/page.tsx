'use client';

import { Mail, Github, Linkedin, Calendar, MapPin, Briefcase, GraduationCap, Code2, Rocket, Layers, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const skills = [
  { name: 'Linux & Ảo hóa (Virtualization)', level: '95%', icons: [Layers] },
  { name: 'Hệ thống & Lưu trữ SAN', level: '90%', icons: [Database] },
  { name: 'Phần cứng Máy chủ (HPE, Dell, IBM...)', level: '90%', icons: [Cpu] },
  { name: 'Automation & DevOps', level: '80%', icons: [Rocket] }
];

function Database(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
  );
}

function Cpu(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
  );
}

export default function AboutPage() {
  return (
    <div className="pt-32 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-center gap-12 mb-20">
          <div className="lg:w-1/3">
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary to-indigo-500 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative aspect-square bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] overflow-hidden">
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <span className="text-8xl font-display font-bold">LM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-2/3">
            <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest mb-6 inline-block">
              Về tôi
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white mb-6">
              LƯU ĐÌNH <span className="text-gradient">MÁC</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              Tôi là một <strong>System Engineer (Linux Expert)</strong> giàu kinh nghiệm chuyên về hạ tầng máy chủ vật lý (Hardware Server), ảo hóa, lưu trữ và hạ tầng đám mây. Với hơn 5 năm thực chiến, tôi sở hữu khả năng xử lý các sự cố hệ thống trọng yếu và duy trì các môi trường HA.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
               {[
                 { icon: MapPin, text: 'TP. HCM, VN' },
                 { icon: Briefcase, text: 'System Engineer' },
                 { icon: Calendar, text: 'Exp: 5+ Years' },
                 { icon: GraduationCap, text: 'Kỹ sư CNTT' }
               ].map((item, i) => (
                 <div key={i} className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                   <item.icon size={18} className="text-primary" />
                   <span className="text-sm font-medium">{item.text}</span>
                 </div>
               ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <a href="https://luumac.io.vn" target="_blank" className="px-6 py-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-lg transition-all text-primary font-bold border border-slate-100 dark:border-slate-800 flex items-center">
                 <Globe size={18} className="mr-2" />
                 luumac.io.vn
              </a>
              <a href="https://github.com/luudinhmac" target="_blank" className="px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-sm hover:shadow-lg transition-all font-bold flex items-center">
                 <Github size={18} className="mr-2" />
                 GitHub
              </a>
              <a href="mailto:luumac2801@gmail.com" className="px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center">
                <Mail size={18} className="mr-2" />
                Liên hệ ngay
              </a>
            </div>
          </div>
        </div>

        {/* Career Timeline & Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Career Path */}
          <section>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-10">Lộ trình sự nghiệp</h2>
            <div className="space-y-12">
              {[
                { 
                  year: '11/2023 - Hiện tại', 
                  title: 'Chuyên viên Dịch vụ IT', 
                  company: 'CP Công nghệ Giải pháp Thi Thiên', 
                  desc: 'Thiết lập hệ thống SQL Server Failover Cluster Instance (FCI), quản trị lưu trữ HPE MSA 2060 với Storage Tiering. Đặc biệt, xử lý thành công các sự cố khẩn cấp: khôi phục root ESXi 8 cho BV Bưu điện sau 10 ngày gián đoạn và khôi phục password ESXi 7 cho Vietsovpetro Resort Hồ Tràm với thời gian downtime cực thấp.' 
                },
                { 
                  year: '2025', 
                  title: 'Kỹ sư Hệ thống Freelance', 
                  company: 'Dự án Cloud & Automation', 
                  desc: 'Hỗ trợ triển khai Private Cloud sử dụng OpenStack (Kolla-Ansible), xử lý sự cố worker node tham gia cụm Kubernetes và khôi phục workload cho đối tác.' 
                },
                { 
                  year: '09/2020 - 04/2022', 
                  title: 'Chuyên viên Hệ thống IT', 
                  company: 'CP Kỹ thuật Delta (DEC)', 
                  desc: 'Vận hành toàn diện hạ tầng OpenStack, cụm Proxmox và CEPH Storage. Xây dựng Private Cloud Nextcloud tích hợp SSO ADFS. Tự động hóa vận hành bằng Python/Bash, trực tiếp giúp giảm 80% khối lượng công việc thủ công của team.' 
                },
                { 
                  year: '01/2019 - 12/2019', 
                  title: 'Vận hành Hệ thống', 
                  company: 'Berjaya Gia Thịnh', 
                  desc: 'Quản trị Online Sell Server (OSS) trên hệ điều hành OpenVMS cho hệ thống Vietlott. Đảm bảo quy trình sao lưu dữ liệu hàng ngày/tuần vào băng từ (Tape Backup) diễn ra an toàn, chính xác.' 
                }
              ].map((job, i) => (
                <div key={i} className="relative pl-12 before:content-[''] before:absolute before:left-0 before:top-2 before:w-6 before:h-6 before:bg-white dark:before:bg-slate-950 before:border-4 before:border-primary before:rounded-full before:z-10 after:content-[''] after:absolute after:left-[11px] after:top-8 after:w-0.5 after:h-[calc(100%+32px)] after:bg-slate-200 dark:after:bg-slate-800 last:after:hidden">
                  <span className="text-xs font-bold text-primary mb-2 block">{job.year}</span>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{job.title}</h4>
                  <p className="text-sm font-bold text-slate-400 mb-3">{job.company}</p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{job.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Skills Section */}
          <section>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-10">Kỹ năng cốt lõi</h2>
            <div className="space-y-8">
              {skills.map((skill, i) => {
                const Icon = skill.icons[0];
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <Icon size={20} />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{skill.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{skill.level}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(139,92,246,0.3)]" 
                        style={{ width: skill.level }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-16 p-8 glass rounded-[2.5rem] bg-gradient-to-br from-primary/5 to-indigo-500/5">
               <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-4 italic">"Duy trì tính sẵn sàng cao là ưu tiên hàng đầu."</h4>
               <p className="text-slate-500 text-sm leading-relaxed">
                 Tôi cam kết tối ưu hóa hạ tầng và tự động hóa quy trình để đạt được hiệu quả vận hành tối đa cho doanh nghiệp.
               </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
