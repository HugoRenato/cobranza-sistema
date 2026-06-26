-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `tipoCuenta` ENUM('CLIENTE_MAYORISTA', 'TIENDA_INTERNA', 'OTRO') NOT NULL DEFAULT 'CLIENTE_MAYORISTA';

-- AlterTable
ALTER TABLE `movimientocuentacliente` ADD COLUMN `compensacionId` INTEGER NULL,
    MODIFY `tipo` ENUM('VENTA', 'ABONO', 'AJUSTE', 'ANULACION', 'COMPENSACION_ABONO', 'COMPENSACION_CARGO') NOT NULL;

-- AlterTable
ALTER TABLE `ventacredito` ADD COLUMN `origen` ENUM('PRODUCTOS', 'COMPENSACION') NOT NULL DEFAULT 'PRODUCTOS';

-- CreateTable
CREATE TABLE `CompensacionCuenta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteOrigenId` INTEGER NOT NULL,
    `cuentaDestinoId` INTEGER NOT NULL,
    `ventaDestinoId` INTEGER NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `unidadNegocio` ENUM('MAYORISTA', 'TIENDA_ABARROTES') NOT NULL DEFAULT 'TIENDA_ABARROTES',
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `motivo` VARCHAR(191) NOT NULL,
    `referencia` VARCHAR(191) NULL,
    `observacion` VARCHAR(191) NULL,
    `estado` ENUM('VALIDA', 'ANULADA') NOT NULL DEFAULT 'VALIDA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompensacionCuenta_ventaDestinoId_key`(`ventaDestinoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompensacionAplicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compensacionId` INTEGER NOT NULL,
    `ventaId` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MovimientoCuentaCliente` ADD CONSTRAINT `MovimientoCuentaCliente_compensacionId_fkey` FOREIGN KEY (`compensacionId`) REFERENCES `CompensacionCuenta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompensacionCuenta` ADD CONSTRAINT `CompensacionCuenta_clienteOrigenId_fkey` FOREIGN KEY (`clienteOrigenId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompensacionCuenta` ADD CONSTRAINT `CompensacionCuenta_cuentaDestinoId_fkey` FOREIGN KEY (`cuentaDestinoId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompensacionCuenta` ADD CONSTRAINT `CompensacionCuenta_ventaDestinoId_fkey` FOREIGN KEY (`ventaDestinoId`) REFERENCES `VentaCredito`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompensacionAplicacion` ADD CONSTRAINT `CompensacionAplicacion_compensacionId_fkey` FOREIGN KEY (`compensacionId`) REFERENCES `CompensacionCuenta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompensacionAplicacion` ADD CONSTRAINT `CompensacionAplicacion_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
