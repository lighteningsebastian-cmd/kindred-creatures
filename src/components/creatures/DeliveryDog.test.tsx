import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DeliveryDog } from "./DeliveryDog";

describe("DeliveryDog", () => {
  it("renders decorative svg artwork (hidden from the accessibility tree)", () => {
    const { container } = render(<DeliveryDog className="w-64" />);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveClass("w-64");
    expect(container.querySelector("svg")).toBeInTheDocument();
    // Dog anatomy present: legs, body, parcel
    expect(container.querySelectorAll("path").length).toBeGreaterThan(8);
    expect(container.querySelector("rect")).toBeInTheDocument();
  });
});
