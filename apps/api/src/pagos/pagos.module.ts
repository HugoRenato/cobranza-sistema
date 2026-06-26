import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [PagosController],
  providers: [PagosService],
})
export class PagosModule {}
