import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CartDog } from "./CartDog";

function getWrapper(container: HTMLElement) {
  const wrapper = container.querySelector("[data-state]");
  if (!wrapper) throw new Error("CartDog wrapper with data-state not found");
  return wrapper;
}

describe("CartDog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the badge count on the basket", () => {
    render(<CartDog count={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders no badge when the cart is empty", () => {
    const { container } = render(<CartDog count={0} />);
    expect(container.textContent).toBe("");
    expect(getWrapper(container)).toHaveAttribute("data-state", "idle");
  });

  it("pops when the count increases, then settles back to idle", () => {
    const { container, rerender } = render(<CartDog count={1} />);
    expect(getWrapper(container)).toHaveAttribute("data-state", "idle");

    rerender(<CartDog count={2} />);
    expect(getWrapper(container)).toHaveAttribute("data-state", "popped");

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(getWrapper(container)).toHaveAttribute("data-state", "idle");
  });

  it("does not pop when the count decreases", () => {
    const { container, rerender } = render(<CartDog count={3} />);
    rerender(<CartDog count={2} />);
    expect(getWrapper(container)).toHaveAttribute("data-state", "idle");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("peeks while the parent control is engaged", () => {
    const { container, rerender } = render(<CartDog count={1} engaged={false} />);
    rerender(<CartDog count={1} engaged />);
    expect(getWrapper(container)).toHaveAttribute("data-state", "peeking");
    rerender(<CartDog count={1} engaged={false} />);
    expect(getWrapper(container)).toHaveAttribute("data-state", "idle");
  });
});
