const snapApiBase = (isProduction: boolean) =>
  isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";

export type SnapItemDetail = {
  id: string;
  price: number;
  quantity: number;
  name: string;
};

export async function createSnapToken(params: {
  serverKey: string;
  isProduction: boolean;
  orderId: string;
  grossAmount: number;
  items: SnapItemDetail[];
  customer: { firstName: string; email: string };
}): Promise<string> {
  const base = snapApiBase(params.isProduction);
  const auth = Buffer.from(`${params.serverKey}:`).toString("base64");

  const res = await fetch(`${base}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      item_details: params.items.map(i => ({
        id: i.id,
        price: i.price,
        quantity: i.quantity,
        name: i.name.slice(0, 50),
      })),
      customer_details: {
        first_name: params.customer.firstName.slice(0, 50),
        email: params.customer.email,
      },
      locale: "id",
      credit_card: {
        secure: true,
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Midtrans ${res.status}: ${raw}`);
  }

  let data: { token?: string };
  try {
    data = JSON.parse(raw) as { token?: string };
  } catch {
    throw new Error("Midtrans: invalid JSON response");
  }

  if (!data.token) {
    throw new Error("Midtrans: response missing token");
  }

  return data.token;
}
