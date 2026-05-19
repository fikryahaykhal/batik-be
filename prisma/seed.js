import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "user@batiknusa.id" },
    update: {},
    create: {
      name: "Batik User",
      email: "user@batiknusa.id",
      password: hashed,
    },
  });

  const products = [
    {
      name: "Batik Parang Premium",
      description: "Motif klasik parang dengan bahan katun premium.",
      price: 325000,
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
    },
    {
      name: "Batik Mega Mendung",
      description: "Warna lembut dengan motif mega mendung khas Cirebon.",
      price: 285000,
      stock: 25,
      imageUrl: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f",
    },
    {
      name: "Batik Kawung Modern",
      description: "Desain modern dengan sentuhan motif kawung.",
      price: 249000,
      stock: 30,
      imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b",
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: product,
      create: product,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
