import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProductosModule } from './productos/productos.module';
import { VentasModule } from './ventas/ventas.module';
import { PagosModule } from './pagos/pagos.module';
import { EstadoCuentaModule } from './estado-cuenta/estado-cuenta.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ReportesModule } from './reportes/reportes.module';
import { CompensacionesModule } from './compensaciones/compensaciones.module';
import { AjustesVentaModule } from './ajustes-venta/ajustes-venta.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    AuditModule,
    UsuariosModule,
    ClientesModule,
    ProductosModule,
    VentasModule,
    PagosModule,
    EstadoCuentaModule,
    DashboardModule,
    WhatsappModule,
    ReportesModule,
    CompensacionesModule,
    AjustesVentaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
