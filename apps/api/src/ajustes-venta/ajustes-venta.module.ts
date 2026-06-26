import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AjustesVentaController } from './ajustes-venta.controller';
import { AjustesVentaService } from './ajustes-venta.service';

@Module({
  imports: [PrismaModule],
  controllers: [AjustesVentaController],
  providers: [AjustesVentaService],
})
export class AjustesVentaModule {}
