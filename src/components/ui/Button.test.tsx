import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a button element by default with type=button", () => {
    render(<Button>Save</Button>);
    const el = screen.getByRole("button", { name: "Save" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("type", "button");
  });

  it("renders a link (anchor) when href is passed", () => {
    render(<Button href="/products/hoodie">Create theirs</Button>);
    const link = screen.getByRole("link", { name: "Create theirs" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/products/hoodie");
  });

  it("applies primary variant classes", () => {
    render(<Button variant="primary">Buy</Button>);
    const el = screen.getByRole("button", { name: "Buy" });
    expect(el).toHaveClass("bg-btn");
    expect(el).toHaveClass("text-base");
    expect(el).toHaveClass("rounded-full");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Details</Button>);
    const el = screen.getByRole("button", { name: "Details" });
    expect(el).toHaveClass("border-ink");
    expect(el).toHaveClass("text-ink");
  });

  it("forwards the disabled attribute to the button", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });
});
