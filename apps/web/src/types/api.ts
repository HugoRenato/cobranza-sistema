export type Cliente = {
  id: number;
  nombre: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  activo: boolean;
};

export type UsuarioEstado = "ACTIVO" | "INACTIVO";

export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  estado: UsuarioEstado;
  ultimoLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginResponse = {
  accessToken: string;
  usuario: Usuario;
};

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "ANULAR"
  | "AJUSTE"
  | "COMPENSACION"
  | "DOWNLOAD";

export type AuditLog = {
  id: number;
  usuarioId?: number | null;
  usuarioEmail?: string | null;
  action: AuditAction;
  module: string;
  entity?: string | null;
  entityId?: string | null;
  description: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export type Producto = {
  id: number;
  nombre: string;
  codigo?: string | null;
  descripcion?: string | null;
  unidad?: string | null;
  precioBase: number | string;
  stock?: number | string | null;
  activo: boolean;
};

export type VentaDetalle = {
  id: number;
  ventaId: number;
  productoId: number;
  producto?: Producto;
  cantidad: number | string;
  precioUnitario: number | string;
  subtotal: number | string;
};

export type VentaCredito = {
  id: number;
  clienteId: number;
  cliente: Cliente;
  fechaVenta: string;
  fechaCompromisoPago?: string | null;
  total: number | string;
  saldoPendiente: number | string;
  estado: string;
  observacion?: string | null;
  detalles?: VentaDetalle[];
};

export type CreateVentaPayload = {
  clienteId: number;
  fechaCompromisoPago?: string;
  observacion?: string;
  items: Array<{
    productoId: number;
    cantidad: number;
    precioUnitario?: number;
  }>;
};

export type MedioPago =
  | "EFECTIVO"
  | "YAPE"
  | "PLIN"
  | "TRANSFERENCIA"
  | "TARJETA"
  | "OTRO";

export type PagoAbono = {
  id: number;
  clienteId: number;
  cliente: Cliente;
  monto: number | string;
  medioPago: MedioPago;
  fechaPago: string;
  referencia?: string | null;
  observacion?: string | null;
  estado: "VALIDO" | "ANULADO" | string;
};

export type EstadoCuentaCliente = {
  cliente: Pick<Cliente, "id" | "nombre" | "documento" | "telefono">;
  resumen: {
    saldoActual: number;
    totalVendidoCredito: number;
    totalAbonado: number;
    deudaPendiente: number;
    deudaVencida: number;
    cantidadVentasPendientes: number;
    cantidadPagos: number;
  };
  ventasPendientes: VentaCredito[];
  pagos: PagoAbono[];
  movimientos: MovimientoCuenta[];
};

export type MovimientoCuenta = {
  id: number;
  fecha: string;
  tipo: "VENTA" | "ABONO" | "AJUSTE" | "ANULACION" | string;
  descripcion: string;
  cargo: number | string;
  abono: number | string;
  saldo: number | string;
};

export type CreatePagoPayload = {
  clienteId: number;
  monto: number;
  medioPago: MedioPago;
  fechaPago?: string;
  referencia?: string;
  observacion?: string;
};

export type DashboardCobranza = {
  resumen: {
    totalPorCobrar: number;
    totalVendidoCredito: number;
    totalAbonado: number;
    pagosDelDia: number;
    pagosDelMes: number;
    clientesConDeuda: number;
    ventasPendientes: number;
    ventasVencidas: number;
    deudaVencida: number;
  };
  topClientesDeudores: Array<{
    cliente: {
      id: number;
      nombre: string | null;
      documento?: string | null;
      telefono?: string | null;
    };
    deudaPendiente: number;
  }>;
  ventasRecientes: Array<{
    id: number;
    fechaVenta: string;
    cliente: {
      id: number;
      nombre: string;
      documento?: string | null;
    };
    total: number;
    saldoPendiente: number;
    estado: string;
  }>;
  pagosRecientes: Array<{
    id: number;
    fechaPago: string;
    cliente: {
      id: number;
      nombre: string;
      documento?: string | null;
    };
    monto: number;
    medioPago: string;
    estado: string;
  }>;
};
