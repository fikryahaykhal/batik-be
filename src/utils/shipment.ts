export interface ShipmentCheckpoint {
  label: string;
  scheduledAt: string;
}

export interface ShipmentSchedule {
  estimatedArrival: string;
  checkpoints: ShipmentCheckpoint[];
}

const toIso = (date: Date) => date.toISOString();

export const buildShipmentSchedule = (itemCount: number, totalAmount: number): ShipmentSchedule => {
  const now = new Date();
  const complexity = Math.ceil(totalAmount / 250000);
  const processingHours = 2 + itemCount;
  const packedAt = new Date(now.getTime() + (processingHours + complexity) * 3600 * 1000);
  const courierAt = new Date(now.getTime() + (processingHours + complexity + 6) * 3600 * 1000);
  const deliveredAt = new Date(now.getTime() + (processingHours + complexity + 28) * 3600 * 1000);

  return {
    estimatedArrival: toIso(deliveredAt),
    checkpoints: [
      { label: "Pembayaran diverifikasi", scheduledAt: toIso(now) },
      { label: "Pesanan diproses gudang", scheduledAt: toIso(packedAt) },
      { label: "Diserahkan ke kurir", scheduledAt: toIso(courierAt) },
      { label: "Estimasi tiba", scheduledAt: toIso(deliveredAt) },
    ],
  };
};
