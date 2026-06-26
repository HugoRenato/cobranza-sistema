import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query('usuarioId') usuarioId?: string,
    @Query('action') action?: AuditAction,
    @Query('module') module?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    const fechas = this.parseFechas(fechaDesde, fechaHasta);

    return this.auditService.findAll({
      usuarioId: usuarioId ? Number(usuarioId) : undefined,
      action,
      module,
      entity,
      entityId,
      ...fechas,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const audit = await this.auditService.findOne(id);

    if (!audit) {
      throw new NotFoundException(`Registro de auditoría ${id} no encontrado`);
    }

    return audit;
  }

  private parseFechas(fechaDesde?: string, fechaHasta?: string) {
    const desde = this.parseFecha(fechaDesde, 'fechaDesde', false);
    const hasta = this.parseFecha(fechaHasta, 'fechaHasta', true);

    if (desde && hasta && desde > hasta) {
      throw new BadRequestException(
        'fechaDesde no puede ser mayor que fechaHasta',
      );
    }

    return { fechaDesde: desde, fechaHasta: hasta };
  }

  private parseFecha(
    value: string | undefined,
    campo: string,
    finDelDia: boolean,
  ) {
    if (!value) {
      return undefined;
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        finDelDia ? 23 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 999 : 0,
      );

      if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
      ) {
        throw new BadRequestException(`${campo} no es válida`);
      }

      return date;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${campo} no es válida`);
    }

    return date;
  }
}
