import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProductRange } from "@/components/sections/ProductRange";
import { DeliveryPromise } from "@/components/sections/DeliveryPromise";
import { LoveWall } from "@/components/sections/LoveWall";
import { FaqTeaser } from "@/components/sections/FaqTeaser";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ProductRange />
      <DeliveryPromise />
      <LoveWall />
      <FaqTeaser />
    </>
  );
}
