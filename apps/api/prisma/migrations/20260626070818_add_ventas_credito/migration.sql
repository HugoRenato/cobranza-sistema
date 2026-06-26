-- CreateTable
CREATE TABLE `VentaCredito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `fechaVenta` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaCompromisoPago` DATETIME(3) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `saldoPendiente` DECIMAL(10, 2) NOT NULL,
    `estado` ENUM('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA', 'VENCIDA') NOT NULL DEFAULT 'PENDIENTE',
    `observacion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VentaDetalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ventaId` INTEGER NOT NULL,
    `productoId` INTEGER NOT NULL,
    `cantidad` DECIMAL(10, 2) NOT NULL,
    `precioUnitario` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovimientoCuentaCliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `ventaId` INTEGER NULL,
    `tipo` ENUM('VENTA', 'ABONO', 'AJUSTE', 'ANULACION') NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `cargo` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `abono` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `saldo` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VentaCredito` ADD CONSTRAINT `VentaCredito_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VentaDetalle` ADD CONSTRAINT `VentaDetalle_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VentaDetalle` ADD CONSTRAINT `VentaDetalle_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovimientoCuentaCliente` ADD CONSTRAINT `MovimientoCuentaCliente_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovimientoCuentaCliente` ADD CONSTRAINT `MovimientoCuentaCliente_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
