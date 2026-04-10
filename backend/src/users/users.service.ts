import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private validatePassword(password: string): boolean {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\S]{8,}$/;
    return regex.test(password);
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullname: true,
        avatar: true,
        profession: true,
        role: true,
        phone: true,
        birthday: true,
        address: true,
        created_at: true,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullname: true,
        avatar: true,
        profession: true,
        role: true,
        phone: true,
        birthday: true,
        address: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return user;
  }

  async create(data: any) {
    if (!this.validatePassword(data.password)) {
      throw new BadRequestException('Mật khẩu phải tối thiểu 8 ký tự, bao gồm cả chữ và số.');
    }
    const hash = await bcrypt.hash(data.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          password: hash,
          role: data.role || 'editor',
          profession: data.profession || 'Người dùng mới',
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new BadRequestException('Tên đăng nhập đã tồn tại');
      }
      throw e;
    }
  }

  async update(id: number, currentUser: any, data: any) {
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      throw new ForbiddenException('Bạn không có quyền sửa thông tin này.');
    }
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });
    const targetUser = await this.prisma.user.findUnique({ where: { id } });

    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.role === 'admin' && adminCount <= 1) {
      throw new BadRequestException('Không thể xóa admin cuối cùng của hệ thống');
    }

    return this.prisma.user.delete({ where: { id } });
  }
}
