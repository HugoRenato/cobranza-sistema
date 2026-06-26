import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/get-user.decorator';

export type AuditContext = {
  user?: AuthUser;
  ip?: string;
  userAgent?: string;
};

export type AuditInput = {
  usuarioId?: number;
  usuarioEmail?: string;
  action: AuditAction;
  module: string;
  entity?: string;
  entityId?: string | number;
  description: string;
  beforeData?: unknown;
  afterData?: unknown;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: AuditInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          usuarioId: data.usuarioId,
          usuarioEmail: data.usuarioEmail,
          action: data.action,
          module: data.module,
          entity: data.entity,
          entityId:
            data.entityId === undefined ? undefined : String(data.entityId),
          description: data.description,
          beforeData: this.toJsonValue(data.beforeData),
          afterData: this.toJsonValue(data.afterData),
          ip: data.ip,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar auditoría: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  logWithContext(context: AuditContext, data: AuditInput) {
    return this.log({
      ...data,
      usuarioId: data.usuarioId ?? context.user?.id,
      usuarioEmail: data.usuarioEmail ?? context.user?.email,
      ip: data.ip ?? context.ip,
      userAgent: data.userAgent ?? context.userAgent,
    });
  }

  contextFromRequest(request: Request): AuditContext {
    return {
      user: request.user as AuthUser | undefined,
      ip: this.getIp(request),
      userAgent: request.get('user-agent'),
    };
  }

  findAll(filters: {
    usuarioId?: number;
    action?: AuditAction;
    module?: string;
    entity?: string;
    entityId?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.module ? { module: filters.module } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.fechaDesde || filters.fechaHasta
        ? {
            createdAt: {
              ...(filters.fechaDesde ? { gte: filters.fechaDesde } : {}),
              ...(filters.fechaHasta ? { lte: filters.fechaHasta } : {}),
            },
          }
        : {}),
    };

    return this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  }

  findOne(id: number) {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }

  private getIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    return request.ip;
  }

  private toJsonValue(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return this.sanitize(value) as Prisma.InputJsonValue;
  }

  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (this.isDecimalLike(value)) {
      return value.toFixed();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !this.isSensitiveKey(key))
        .map(([key, item]) => [key, this.sanitize(item)]),
    );
  }

  private isSensitiveKey(key: string) {
    const normalized = key.toLowerCase();

    return (
      normalized.includes('password') ||
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('hash')
    );
  }

  private isDecimalLike(value: object): value is { toFixed(): string } {
    return 'toFixed' in value && 's' in value && 'e' in value && 'd' in value;
  }
}
