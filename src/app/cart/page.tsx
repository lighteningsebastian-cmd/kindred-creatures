import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your cart | Kindred Creatures",
  description:
    "Check over the portraits in your cart before you order. Printed in South Africa.",
};

export default function CartPage() {
  return <CartView />;
}
