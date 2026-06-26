import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EstadoCuentaController } from './estado-cuenta.controller';
import { EstadoCuentaService } from './estado-cuenta.service';

@Module({
  imports: [PrismaModule],
  controllers: [EstadoCuentaController],
  providers: [EstadoCuentaService],
})
export class EstadoCuentaModule {}
