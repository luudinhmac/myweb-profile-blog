import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  private sanitizeOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
    allowedAttributes: {
      '*': ['style', 'class', 'id'],
      'a': ['href', 'name', 'target'],
      'img': ['src', 'alt', 'width', 'height']
    }
  };

  async findAll(user?: any) {
    const where = user && user.role !== 'admin' ? { author_id: user.id } : {};
    return this.prisma.post.findMany({
      where,
      orderBy: [
        { is_pinned: 'desc' },
        { created_at: 'desc' }
      ],
      include: {
        Category: true,
        User: {
          select: { fullname: true }
        },
        Tag: true
      }
    });
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        Category: true,
        User: {
          select: { fullname: true, avatar: true }
        },
        Tag: true
      }
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(user: any, data: any) {
    const { tags, ...postData } = data;
    const cleanContent = sanitizeHtml(data.content, this.sanitizeOptions);
    
    return this.prisma.post.create({
      data: {
        ...postData,
        content: cleanContent,
        author_id: user.id,
        is_pinned: (user.role === 'admin' && data.is_pinned) ? true : false,
        Tag: {
          connectOrCreate: tags?.split(',').map(tag => ({
            where: { name: tag.trim() },
            create: { name: tag.trim() }
          }))
        }
      }
    });
  }

  async update(id: number, user: any, data: any) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (user.role !== 'admin' && post.author_id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền sửa bài viết này.');
    }

    const { tags, ...postData } = data;
    const cleanContent = data.content ? sanitizeHtml(data.content, this.sanitizeOptions) : post.content;

    return this.prisma.post.update({
      where: { id },
      data: {
        ...postData,
        content: cleanContent,
        is_pinned: user.role === 'admin' ? data.is_pinned : post.is_pinned,
        Tag: {
          set: [], // Clear old tags
          connectOrCreate: tags?.split(',').map(tag => ({
            where: { name: tag.trim() },
            create: { name: tag.trim() }
          }))
        }
      }
    });
  }

  async remove(id: number, user: any) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (user.role !== 'admin' && post.author_id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này.');
    }
    return this.prisma.post.delete({ where: { id } });
  }

  async togglePin(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.post.update({
      where: { id },
      data: { is_pinned: !post.is_pinned }
    });
  }
}
