"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DeliveryDog } from "@/components/creatures/DeliveryDog";
import { CartButton } from "@/components/layout/CartButton";

/**
 * Interactive preview of the signature creature animations at realistic
 * sizes, on alternating section backgrounds. Dev-only, not indexed.
 */
export function CreaturesDemo() {
  const [count, setCount] = useState(0);

  return (
    <div>
      {/* Delivery dog: landing section context */}
      <section className="bg-base py-20">
        <Container className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              With you in about five working days
            </h2>
            <p className="mt-3 max-w-md text-muted">
              Every order is printed in Jeffreys Bay and couriered to your door,
              carried the last stretch with great ceremony.
            </p>
          </div>
          <DeliveryDog className="mx-auto w-full max-w-md" />
        </Container>
      </section>

      {/* Cart dog: mock nav row plus add-to-cart demo */}
      <section className="bg-surface py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Cart dog
          </h2>
          <p className="mt-3 max-w-md text-muted">
            Hover or focus the basket for a peek. Add an item and the dog pops
            up to celebrate.
          </p>
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-line bg-base px-6 py-3">
            <Link
              href="/"
              className="font-display text-lg font-semibold tracking-tight text-ink"
            >
              Kindred Creatures
            </Link>
            <nav className="hidden items-center gap-8 md:flex">
              <span className="text-sm text-muted">Shop</span>
              <span className="text-sm text-muted">How it works</span>
              <span className="text-sm text-muted">FAQ</span>
            </nav>
            <CartButton count={count} />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={() => setCount((c) => c + 1)}>Add to cart</Button>
            <Button
              variant="secondary"
              onClick={() => setCount((c) => Math.max(0, c - 1))}
            >
              Remove one
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
