import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { env } from "./config/env.js";
import { createSnapToken } from "./lib/midtrans.js";
import { prisma } from "./lib/prisma.js";
import { requireAuth } from "./middleware/auth.js";
import { buildShipmentSchedule } from "./utils/shipment.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    snapEnabled: Boolean(env.midtransServerKey),
  });
});

app.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      stock: true,
      imageUrl: true,
    },
  });
  res.json(products);
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ message: "Email dan password wajib diisi" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Email atau password salah" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: "Email atau password salah" });
  }

  const accessToken = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return res.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ message: "User tidak ditemukan" });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
});

app.post("/checkout", requireAuth, async (req, res) => {
  const { items, totalAmount } = req.body as {
    items?: Array<{ productId: number; qty: number; unitPrice: number }>;
    totalAmount?: number;
  };

  if (!items?.length || typeof totalAmount !== "number") {
    return res.status(400).json({ message: "Payload checkout tidak valid" });
  }

  for (const item of items) {
    if (
      !Number.isInteger(item.productId) ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      !Number.isInteger(item.unitPrice) ||
      item.unitPrice < 0
    ) {
      return res.status(400).json({ message: "Payload checkout tidak valid" });
    }
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ message: "User tidak ditemukan" });
  }

  const productIds = [...new Set(items.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const productById = new Map(products.map(p => [p.id, p]));

  let computedTotal = 0;
  const snapItems: { id: string; price: number; quantity: number; name: string }[] = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      return res.status(400).json({ message: `Produk ${item.productId} tidak ditemukan` });
    }
    if (item.unitPrice !== product.price) {
      return res.status(400).json({ message: "Harga produk tidak sesuai. Muat ulang halaman." });
    }
    if (product.stock < item.qty) {
      return res.status(400).json({ message: `Stok ${product.name} tidak mencukupi` });
    }
    computedTotal += item.qty * item.unitPrice;
    snapItems.push({
      id: String(product.id),
      price: item.unitPrice,
      quantity: item.qty,
      name: product.name,
    });
  }

  if (computedTotal !== totalAmount) {
    return res.status(400).json({ message: "Total pesanan tidak sesuai" });
  }

  if (!env.midtransServerKey && !env.allowCheckoutWithoutPayment) {
    return res.status(503).json({
      message:
        "Pembayaran belum diaktifkan: isi MIDTRANS_SERVER_KEY di .env backend (Server Key sandbox: https://dashboard.sandbox.midtrans.com/settings/config_info). Di frontend isi VITE_MIDTRANS_CLIENT_KEY yang berpasangan. Untuk uji tanpa gateway, set ALLOW_CHECKOUT_WITHOUT_PAYMENT=true.",
    });
  }

  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const shipmentSchedule = buildShipmentSchedule(itemCount, totalAmount);

  const order = await prisma.order.create({
    data: {
      userId: req.userId!,
      totalAmount,
      shipmentSchedule: shipmentSchedule as unknown as Prisma.InputJsonValue,
      items: {
        create: items.map(item => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      },
    },
  });

  let snapToken: string | undefined;

  if (env.midtransServerKey) {
    try {
      snapToken = await createSnapToken({
        serverKey: env.midtransServerKey,
        isProduction: env.midtransIsProduction,
        orderId: order.id,
        grossAmount: totalAmount,
        items: snapItems,
        customer: {
          firstName: user.name || "Customer",
          email: user.email,
        },
      });
    } catch (err) {
      console.error(err);
      try {
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.order.delete({ where: { id: order.id } });
      } catch (rollbackErr) {
        console.error("Gagal rollback pesanan setelah error Midtrans:", rollbackErr);
      }
      return res.status(502).json({
        message: "Gagal menyiapkan pembayaran. Coba lagi atau periksa konfigurasi Midtrans.",
      });
    }
  }

  return res.json({
    orderId: order.id,
    totalAmount: order.totalAmount,
    shipment: shipmentSchedule,
    snapToken,
    message: snapToken
      ? "Lanjutkan pembayaran di jendela Midtrans Snap."
      : "Checkout berhasil! Pesanan kamu sedang diproses.",
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${env.port}`);
  if (!env.midtransServerKey) {
    if (env.allowCheckoutWithoutPayment) {
      console.warn("[midtrans] MIDTRANS_SERVER_KEY kosong — checkout berjalan tanpa Snap (ALLOW_CHECKOUT_WITHOUT_PAYMENT=true).");
    } else {
      console.warn(
        "[midtrans] MIDTRANS_SERVER_KEY kosong — POST /checkout akan 503 sampai kunci sandbox/production diisi (lihat .env.example)."
      );
    }
  }
});

const shutdown = async (signal: string) => {
  console.info(`${signal} received, closing server…`);
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error("Prisma disconnect error:", e);
  }
  server.close(err => {
    if (err) console.error("HTTP server close error:", err);
    process.exit(err ? 1 : 0);
  });
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
