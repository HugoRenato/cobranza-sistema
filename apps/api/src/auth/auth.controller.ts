import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { AuthUser } from '../common/decorators/get-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    nombre: string;
    email: string;
    estado: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      loginDto,
      this.auditService.contextFromRequest(request),
    );
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Post('logout')
  async logout(@Req() request: Request) {
    const context = this.auditService.contextFromRequest(request);
    await this.auditService.logWithContext(context, {
      action: AuditAction.LOGOUT,
      module: 'auth',
      entity: 'Usuario',
      entityId: context.user?.id,
      description: `Logout de ${context.user?.email ?? 'usuario'}`,
    });

    return this.authService.logout();
  }

  @Patch('change-password')
  changePassword(
    @GetUser() user: AuthUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(
      user,
      changePasswordDto,
      this.auditService.contextFromRequest(request),
    );
  }
}
