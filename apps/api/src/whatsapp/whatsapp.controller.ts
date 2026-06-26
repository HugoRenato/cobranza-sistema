import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly auditService: AuditService,
  ) {}

  @Get('mensajes')
  findAll() {
    return this.whatsappService.findAll();
  }

  @Get('mensajes/cliente/:clienteId')
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.whatsappService.findByCliente(clienteId);
  }

  @Get('mensajes/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.whatsappService.findOne(id);
  }

  @Patch('mensajes/:id/marcar-enviado')
  async marcarEnviado(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    const before = await this.whatsappService.findOne(id);
    const mensaje = await this.whatsappService.marcarEnviado(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'whatsapp',
        entity: 'MensajeWhatsApp',
        entityId: id,
        description: `Mensaje WhatsApp marcado como enviado #${id}`,
        beforeData: before,
        afterData: mensaje,
      },
    );

    return mensaje;
  }

  @Patch('mensajes/:id/marcar-fallido')
  async marcarFallido(
    @Param('id', ParseIntPipe) id: number,
    @Body('error') error?: string,
    @Req() request?: Request,
  ) {
    const before = await this.whatsappService.findOne(id);
    const mensaje = await this.whatsappService.marcarFallido(id, error);

    if (request) {
      await this.auditService.logWithContext(
        this.auditService.contextFromRequest(request),
        {
          action: AuditAction.UPDATE,
          module: 'whatsapp',
          entity: 'MensajeWhatsApp',
          entityId: id,
          description: `Mensaje WhatsApp marcado como fallido #${id}`,
          beforeData: before,
          afterData: mensaje,
        },
      );
    }

    return mensaje;
  }
}
