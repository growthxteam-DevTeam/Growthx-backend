import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';

import { CommentSort } from './dto/get-comments-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DiscussionCommentEntity } from './entities/discussion-comment.entity';

const DEFAULT_PAGE_SIZE = 10;

// Pinned comments always come first, whichever sort is chosen.
const SORT_ORDERS: Record<
  CommentSort,
  FindOptionsOrder<DiscussionCommentEntity>
> = {
  newest: { pinned: 'DESC', createdAt: 'DESC' },
  oldest: { pinned: 'DESC', createdAt: 'ASC' },
  top: { pinned: 'DESC', likeCount: 'DESC', createdAt: 'DESC' },
};

export interface CommentView {
  id: string;
  author: { id: string; name: string; profilePicture: string | null };
  content: string;
  likes: number;
  likedByMe: boolean;
  dislikedByMe: boolean;
  pinned: boolean;
  staffPost: boolean;
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
    sort: CommentSort = 'newest',
  ) {
    const topLevelWhere = mongoWhere({ classId, parentId: null });

    const [topLevel, total] = await Promise.all([
      this.commentsRepository.find({
        where: topLevelWhere,
        order: SORT_ORDERS[sort],
        take: limit,
      }),
      // countBy, not count({ where }): the Mongo driver treats count's argument as a raw filter,
      // so a find-options object silently matches nothing and the total comes back 0.
      this.commentsRepository.countBy(topLevelWhere),
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
        dislikedBy: [],
        likeCount: 0,
        pinned: false,
        staffPost: false,
      }),
    );

    return {
      status: 'Success',
      statusCode: 201,
      data: this.toView(saved, user.id, []),
    };
  }

  // Likes and dislikes are mutually exclusive: choosing one clears the other.
  async toggleReaction(
    commentId: string,
    user: AuthenticatedUser,
    reaction: 'like' | 'dislike',
  ) {
    const comment = await this.findComment(commentId);
    const liked = comment.likedBy ?? [];
    const disliked = comment.dislikedBy ?? [];
    const without = (ids: string[]) => ids.filter((id) => id !== user.id);

    if (reaction === 'like') {
      const alreadyLiked = liked.includes(user.id);
      comment.likedBy = alreadyLiked ? without(liked) : [...liked, user.id];
      comment.dislikedBy = alreadyLiked ? disliked : without(disliked);
    } else {
      const alreadyDisliked = disliked.includes(user.id);
      comment.dislikedBy = alreadyDisliked
        ? without(disliked)
        : [...disliked, user.id];
      comment.likedBy = alreadyDisliked ? liked : without(liked);
    }
    comment.likeCount = comment.likedBy.length;
    await this.commentsRepository.save(comment);

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        likes: comment.likedBy.length,
        likedByMe: comment.likedBy.includes(user.id),
        dislikedByMe: (comment.dislikedBy ?? []).includes(user.id),
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
    const likedBy = comment.likedBy ?? [];

    return {
      id: String(comment._id),
      author: {
        id: comment.authorId,
        name: comment.authorName,
        profilePicture: comment.authorPicture ?? null,
      },
      content: comment.content,
      likes: likedBy.length,
      likedByMe: likedBy.includes(userId),
      dislikedByMe: (comment.dislikedBy ?? []).includes(userId),
      pinned: Boolean(comment.pinned),
      staffPost: Boolean(comment.staffPost),
      createdAt: comment.createdAt,
      replies: replies.map((reply) => this.toView(reply, userId, [])),
    };
  }
}
