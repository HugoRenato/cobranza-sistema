import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompensacionesController } from './compensaciones.controller';
import { CompensacionesService } from './compensaciones.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompensacionesController],
  providers: [CompensacionesService],
})
export class CompensacionesModule {}
