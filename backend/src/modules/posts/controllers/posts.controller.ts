import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { CacheInterceptor, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CreatePostDto,
  UpdatePostDto,
  Post as PostEntity,
} from '@portfolio/contracts';
import { getClientIp } from '../../../common/utils/ip';
import { GetPostsUseCase } from '../services/get-posts.use-case';
import { GetPostUseCase } from '../services/get-post.use-case';
import { CreatePostUseCase } from '../services/create-post.use-case';
import { UpdatePostUseCase } from '../services/update-post.use-case';
import { DeletePostUseCase } from '../services/delete-post.use-case';
import { TogglePinPostUseCase } from '../services/toggle-pin-post.use-case';
import { TogglePublishPostUseCase } from '../services/toggle-publish-post.use-case';
import { ToggleLikePostUseCase } from '../services/toggle-like-post.use-case';
import { GetLikeStatusUseCase } from '../services/get-like-status.use-case';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly getPostsUseCase: GetPostsUseCase,
    private readonly getPostUseCase: GetPostUseCase,
    private readonly createPostUseCase: CreatePostUseCase,
    private readonly updatePostUseCase: UpdatePostUseCase,
    private readonly deletePostUseCase: DeletePostUseCase,
    private readonly togglePinPostUseCase: TogglePinPostUseCase,
    private readonly togglePublishPostUseCase: TogglePublishPostUseCase,
    private readonly toggleLikePostUseCase: ToggleLikePostUseCase,
    private readonly getLikeStatusUseCase: GetLikeStatusUseCase,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get all published posts' })
  @ApiResponse({ status: 200, type: [PostEntity] })
  findAll(
    @Query('q') query?: string,
    @Query('userId') userId?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.getPostsUseCase.execute(
      undefined,
      false,
      query,
      'published',
      sort,
      userIdNum,
      pageNum,
      limitNum,
      category,
    );
  }

  @Get('admin')
  @ApiOperation({ summary: 'Admin: Get all posts with full status' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  findAllAdmin(
    @Req() req: any,
    @Query('q') query?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.getPostsUseCase.execute(
      req.user,
      true,
      query,
      status,
      sort,
      undefined,
      pageNum,
      limitNum,
    );
  }

  @Get('my-posts')
  @ApiOperation({ summary: 'User: Get own posts' })
  @UseGuards(AuthGuard('jwt'))
  findMyPosts(
    @Req() req: any,
    @Query('q') query?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.getPostsUseCase.execute(
      req.user,
      true,
      query,
      status,
      sort,
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get post by id or slug' })
  @ApiResponse({ status: 200, type: PostEntity })
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Query('action') action?: string,
  ) {
    const incrementView = action === 'view';
    return this.getPostUseCase.execute(idOrSlug, incrementView);
  }

  @Post()
  @ApiOperation({ summary: 'Create new post' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  async create(@Req() req: any, @Body() data: CreatePostDto) {
    const result = await this.createPostUseCase.execute(req.user, data);
    await this.cacheManager.clear();
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update post' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() data: UpdatePostDto,
  ) {
    const result = await this.updatePostUseCase.execute(id, req.user, data);
    await this.cacheManager.clear();
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete post' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.deletePostUseCase.execute(
      id,
      req.user,
      getClientIp(req),
    );
    await this.cacheManager.clear();
    return result;
  }

  @Post(':id/pin')
  @ApiOperation({ summary: 'Toggle pin post' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  async togglePin(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.togglePinPostUseCase.execute(id, req.user);
    await this.cacheManager.clear();
    return result;
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Toggle publish status' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('posts:create')
  async togglePublish(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    const result = await this.togglePublishPostUseCase.execute(
      id,
      req.user,
      reason,
    );
    await this.cacheManager.clear();
    return result;
  }

  @Get(':id/like-status')
  @ApiOperation({ summary: 'Get like status for current user' })
  @UseGuards(AuthGuard('jwt'))
  getLikeStatus(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.getLikeStatusUseCase.execute(id, req.user.id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like post' })
  @UseGuards(AuthGuard('jwt'))
  async toggleLike(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.toggleLikePostUseCase.execute(id, req.user.id);
    await this.cacheManager.clear();
    return result;
  }
}
