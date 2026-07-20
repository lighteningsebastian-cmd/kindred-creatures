import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleReviewsLink } from "./GoogleReviewsLink";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GoogleReviewsLink", () => {
  it("renders nothing when the env URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_REVIEWS_URL", "");
    const { container } = render(<GoogleReviewsLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a safe external link when the env URL is set", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_GOOGLE_REVIEWS_URL",
      "https://g.page/r/kindred-creatures/review",
    );
    render(<GoogleReviewsLink />);

    const link = screen.getByRole("link", { name: /read our google reviews/i });
    expect(link).toHaveAttribute(
      "href",
      "https://g.page/r/kindred-creatures/review",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
