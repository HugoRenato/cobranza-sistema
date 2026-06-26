import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProductosModule } from './productos/productos.module';
import { VentasModule } from './ventas/ventas.module';

@Module({
  imports: [PrismaModule, ClientesModule, ProductosModule, VentasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
