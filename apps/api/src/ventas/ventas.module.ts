import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
