import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';

@Module({
  imports: [PrismaModule, ClientesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
