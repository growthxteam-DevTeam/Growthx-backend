import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';

import { CreateCommentDto } from './dto/create-comment.dto';
import { DiscussionCommentEntity } from './entities/discussion-comment.entity';

const DEFAULT_PAGE_SIZE = 10;

export interface CommentView {
  id: string;
  author: { id: string; name: string; profilePicture: string | null };
  content: string;
  likes: number;
  likedByMe: boolean;
  createdAt: Date;
  replies: CommentView[];
}

// Mongo operators ($in, null matching) aren't expressible in TypeORM's typed where clauses.
const mongoWhere = (where: object) =>
  where as unknown as FindOptionsWhere<DiscussionCommentEntity>;

@Injectable()
export class DiscussionsService {
  constructor(
    @InjectRepository(DiscussionCommentEntity)
    private readonly commentsRepository: Repository<DiscussionCommentEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
  ) {}

  async list(
    classId: string,
    user: AuthenticatedUser,
    limit = DEFAULT_PAGE_SIZE,
  ) {
    const topLevelWhere = mongoWhere({ classId, parentId: null });

    const [topLevel, total] = await Promise.all([
      this.commentsRepository.find({
        where: topLevelWhere,
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.commentsRepository.count({ where: topLevelWhere }),
    ]);

    const parentIds = topLevel.map((comment) => String(comment._id));
    const replies = parentIds.length
      ? await this.commentsRepository.find({
          where: mongoWhere({ parentId: { $in: parentIds } }),
          order: { createdAt: 'ASC' },
        })
      : [];

    const repliesByParent = new Map<string, DiscussionCommentEntity[]>();
    for (const reply of replies) {
      const siblings = repliesByParent.get(reply.parentId as string) ?? [];
      siblings.push(reply);
      repliesByParent.set(reply.parentId as string, siblings);
    }

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        comments: topLevel.map((comment) =>
          this.toView(
            comment,
            user.id,
            repliesByParent.get(String(comment._id)) ?? [],
          ),
        ),
        total,
      },
    };
  }

  async create(
    classId: string,
    user: AuthenticatedUser,
    dto: CreateCommentDto,
  ) {
    const author = ObjectId.isValid(user.id)
      ? await this.applicationsRepository.findOne({
          where: { _id: new ObjectId(user.id) },
        })
      : null;
    if (!author) {
      throw new UnauthorizedException('Account no longer exists');
    }

    if (dto.parentId) {
      const parent = await this.findComment(dto.parentId);
      if (parent.classId !== classId || parent.parentId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const saved = await this.commentsRepository.save(
      this.commentsRepository.create({
        classId,
        authorId: user.id,
        authorName: author.applicationPortal.fullName,
        authorPicture: author.submit?.passportPhotoUrl,
        content: dto.content,
        parentId: dto.parentId,
        likedBy: [],
      }),
    );

    return {
      status: 'Success',
      statusCode: 201,
      data: this.toView(saved, user.id, []),
    };
  }

  async toggleLike(commentId: string, user: AuthenticatedUser) {
    const comment = await this.findComment(commentId);

    comment.likedBy = comment.likedBy.includes(user.id)
      ? comment.likedBy.filter((id) => id !== user.id)
      : [...comment.likedBy, user.id];
    await this.commentsRepository.save(comment);

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        likes: comment.likedBy.length,
        likedByMe: comment.likedBy.includes(user.id),
      },
    };
  }

  private async findComment(id: string) {
    const comment = ObjectId.isValid(id)
      ? await this.commentsRepository.findOne({
          where: mongoWhere({ _id: new ObjectId(id) }),
        })
      : null;
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private toView(
    comment: DiscussionCommentEntity,
    userId: string,
    replies: DiscussionCommentEntity[],
  ): CommentView {
    return {
      id: String(comment._id),
      author: {
        id: comment.authorId,
        name: comment.authorName,
        profilePicture: comment.authorPicture ?? null,
      },
      content: comment.content,
      likes: comment.likedBy.length,
      likedByMe: comment.likedBy.includes(userId),
      createdAt: comment.createdAt,
      replies: replies.map((reply) => this.toView(reply, userId, [])),
    };
  }
}
