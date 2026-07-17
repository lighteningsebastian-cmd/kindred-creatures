import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout | Kindred Creatures",
  description:
    "Tell us where your portraits should land. Printed and couriered in South Africa.",
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
