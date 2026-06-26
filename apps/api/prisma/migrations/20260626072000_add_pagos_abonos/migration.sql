-- AlterTable
ALTER TABLE `MovimientoCuentaCliente` ADD COLUMN `pagoId` INTEGER NULL;

-- CreateTable
CREATE TABLE `PagoAbono` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `medioPago` ENUM('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO') NOT NULL,
    `fechaPago` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referencia` VARCHAR(191) NULL,
    `observacion` VARCHAR(191) NULL,
    `estado` ENUM('VALIDO', 'ANULADO') NOT NULL DEFAULT 'VALIDO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PagoAplicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pagoId` INTEGER NOT NULL,
    `ventaId` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `MovimientoCuentaCliente_pagoId_key` ON `MovimientoCuentaCliente`(`pagoId`);

-- AddForeignKey
ALTER TABLE `MovimientoCuentaCliente` ADD CONSTRAINT `MovimientoCuentaCliente_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `PagoAbono`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PagoAbono` ADD CONSTRAINT `PagoAbono_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PagoAplicacion` ADD CONSTRAINT `PagoAplicacion_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `PagoAbono`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PagoAplicacion` ADD CONSTRAINT `PagoAplicacion_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
