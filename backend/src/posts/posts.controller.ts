import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: any, @Body() createPostDto: any) {
    return this.postsService.create(req.user, createPostDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Req() req: any, @Body() updatePostDto: any) {
    return this.postsService.update(+id, req.user, updatePostDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Req() req: any) {
    return this.postsService.remove(+id, req.user);
  }

  @Patch(':id/toggle-pin')
  @UseGuards(AuthGuard('jwt'))
  togglePin(@Param('id') id: string, @Req() req: any) {
    if (req.user.role !== 'admin') throw new Error('Unauthorized');
    return this.postsService.togglePin(+id);
  }
}
