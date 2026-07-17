import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your cart",
  description:
    "Check over the portraits in your cart before you order. Printed in South Africa.",
  // Per-visitor state. There is nothing here to index, and what is here belongs
  // to one person. robots.txt disallows it too; this is the second lock.
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}
