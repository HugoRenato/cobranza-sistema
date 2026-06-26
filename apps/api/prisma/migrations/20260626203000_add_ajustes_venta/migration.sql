-- AlterTable
ALTER TABLE `movimientocuentacliente` ADD COLUMN `ajusteVentaId` INTEGER NULL,
    MODIFY `tipo` ENUM('VENTA', 'ABONO', 'AJUSTE', 'AJUSTE_PRECIO', 'ANULACION', 'COMPENSACION_ABONO', 'COMPENSACION_CARGO') NOT NULL;

-- CreateTable
CREATE TABLE `AjusteVenta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ventaId` INTEGER NOT NULL,
    `ventaDetalleId` INTEGER NULL,
    `clienteId` INTEGER NOT NULL,
    `tipo` ENUM('PRECIO_UNITARIO', 'DESCUENTO_COMERCIAL', 'ERROR_REGISTRO', 'OTRO') NOT NULL DEFAULT 'PRECIO_UNITARIO',
    `estado` ENUM('VALIDO', 'ANULADO') NOT NULL DEFAULT 'VALIDO',
    `precioAnterior` DECIMAL(10, 2) NULL,
    `precioNuevo` DECIMAL(10, 2) NULL,
    `cantidadAfectada` DECIMAL(10, 2) NULL,
    `montoDiferencia` DECIMAL(10, 2) NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `observacion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MovimientoCuentaCliente` ADD CONSTRAINT `MovimientoCuentaCliente_ajusteVentaId_fkey` FOREIGN KEY (`ajusteVentaId`) REFERENCES `AjusteVenta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjusteVenta` ADD CONSTRAINT `AjusteVenta_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjusteVenta` ADD CONSTRAINT `AjusteVenta_ventaDetalleId_fkey` FOREIGN KEY (`ventaDetalleId`) REFERENCES `VentaDetalle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjusteVenta` ADD CONSTRAINT `AjusteVenta_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
