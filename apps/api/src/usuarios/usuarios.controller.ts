import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Post()
  async create(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @Req() request: Request,
  ) {
    const usuario = await this.usuariosService.create(createUsuarioDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.CREATE,
        module: 'usuarios',
        entity: 'Usuario',
        entityId: usuario.id,
        description: `Usuario creado: ${usuario.email}`,
        afterData: usuario,
      },
    );

    return usuario;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Req() request: Request,
  ) {
    const before = await this.usuariosService.findOne(id);
    const usuario = await this.usuariosService.update(id, updateUsuarioDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'usuarios',
        entity: 'Usuario',
        entityId: id,
        description: `Usuario actualizado: ${usuario.email}`,
        beforeData: before,
        afterData: usuario,
      },
    );

    return usuario;
  }

  @Patch(':id/desactivar')
  async desactivar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    const before = await this.usuariosService.findOne(id);
    const usuario = await this.usuariosService.desactivar(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'usuarios',
        entity: 'Usuario',
        entityId: id,
        description: `Usuario desactivado: ${usuario.email}`,
        beforeData: before,
        afterData: usuario,
      },
    );

    return usuario;
  }

  @Patch(':id/activar')
  async activar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    const before = await this.usuariosService.findOne(id);
    const usuario = await this.usuariosService.activar(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'usuarios',
        entity: 'Usuario',
        entityId: id,
        description: `Usuario activado: ${usuario.email}`,
        beforeData: before,
        afterData: usuario,
      },
    );

    return usuario;
  }
}
