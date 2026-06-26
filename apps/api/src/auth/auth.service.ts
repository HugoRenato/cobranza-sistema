import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditAction, UsuarioEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { assertStrongPassword } from '../common/security/password-strength';
import type { AuthUser } from '../common/decorators/get-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto, context: AuditContext) {
    const email = loginDto.email.toLowerCase().trim();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      await this.auditService.logWithContext(context, {
        usuarioEmail: email,
        action: AuditAction.LOGIN,
        module: 'auth',
        entity: 'Usuario',
        description: `Login fallido para ${email}: usuario no existe`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== UsuarioEstado.ACTIVO) {
      await this.auditService.logWithContext(context, {
        usuarioId: usuario.id,
        usuarioEmail: usuario.email,
        action: AuditAction.LOGIN,
        module: 'auth',
        entity: 'Usuario',
        entityId: usuario.id,
        description: `Login fallido para ${usuario.email}: usuario inactivo`,
      });
      throw new UnauthorizedException('Usuario inactivo');
    }

    const passwordValida = await bcrypt.compare(
      loginDto.password,
      usuario.password,
    );

    if (!passwordValida) {
      await this.auditService.logWithContext(context, {
        usuarioId: usuario.id,
        usuarioEmail: usuario.email,
        action: AuditAction.LOGIN,
        module: 'auth',
        entity: 'Usuario',
        entityId: usuario.id,
        description: `Login fallido para ${usuario.email}: password incorrecta`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        ultimoLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
    });

    await this.auditService.logWithContext(context, {
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      action: AuditAction.LOGIN,
      module: 'auth',
      entity: 'Usuario',
      entityId: usuario.id,
      description: `Login exitoso para ${usuario.email}`,
    });

    return {
      accessToken,
      usuario: usuarioActualizado,
    };
  }

  logout() {
    return { message: 'Sesión cerrada correctamente' };
  }

  async changePassword(
    user: AuthUser,
    changePasswordDto: ChangePasswordDto,
    context: AuditContext,
  ) {
    assertStrongPassword(changePasswordDto.newPassword);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.id },
    });

    if (!usuario || usuario.estado !== UsuarioEstado.ACTIVO) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const passwordValida = await bcrypt.compare(
      changePasswordDto.currentPassword,
      usuario.password,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Contraseña actual inválida');
    }

    const password = await bcrypt.hash(changePasswordDto.newPassword, 10);
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { password },
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        ultimoLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.logWithContext(context, {
      action: AuditAction.UPDATE,
      module: 'auth',
      entity: 'Usuario',
      entityId: usuario.id,
      description: `Cambio de contraseña para ${usuario.email}`,
    });

    return actualizado;
  }
}
