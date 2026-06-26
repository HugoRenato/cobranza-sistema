import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { EstadoCuentaService } from './estado-cuenta.service';

@Controller('estado-cuenta')
export class EstadoCuentaController {
  constructor(private readonly estadoCuentaService: EstadoCuentaService) {}

  @Get('cliente/:clienteId')
  findByCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.estadoCuentaService.findByCliente(clienteId, {
      fechaDesde,
      fechaHasta,
    });
  }
}
