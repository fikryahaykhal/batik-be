import dotenv from "dotenv";

dotenv.config();

const trimOrUndefined = (value: string | undefined) => {
  const t = value?.trim();
  return t ? t : undefined;
};

export const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "super-secret-key-change-me",
  /** Server key (secret); when set, checkout returns a Snap token for payment. */
  midtransServerKey: trimOrUndefined(process.env.MIDTRANS_SERVER_KEY),
  midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  /**
   * When true, POST /checkout can succeed without MIDTRANS_SERVER_KEY (no Snap).
   * Default false so "Bayar sekarang" always goes through Midtrans unless explicitly opted out.
   */
  allowCheckoutWithoutPayment: process.env.ALLOW_CHECKOUT_WITHOUT_PAYMENT === "true",
};
