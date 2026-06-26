import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
