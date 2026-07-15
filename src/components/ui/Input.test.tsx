import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("associates the label with the input via htmlFor/id", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input.tagName).toBe("INPUT");
    // getByLabelText only resolves when htmlFor matches the input id.
    expect(input).toHaveAttribute("id");
  });

  it("renders helper text and links it via aria-describedby", () => {
    render(<Input label="Email" helperText="We never share it." />);
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const helper = document.getElementById(describedBy as string);
    expect(helper).toHaveTextContent("We never share it.");
  });

  it("renders error text with role=alert and links it via aria-describedby", () => {
    render(<Input label="Email" error="Enter a valid email." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid email.");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(alert).toHaveAttribute("id", describedBy as string);
  });

  it("hides helper text when an error is present", () => {
    render(
      <Input label="Email" helperText="Helper" error="Broken" />,
    );
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
  });
});
