import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalMailStatus } from "./ApprovalMailStatus";

/**
 * The line that answers "has this customer ever been told?". Never must be
 * unmissable, and sent must never read as arrived.
 */

const at = new Date(Date.UTC(2026, 8, 16, 8, 37));

describe("ApprovalMailStatus", () => {
  it("says never, loudly, when nothing was ever sent", () => {
    render(
      <ApprovalMailStatus state={{ sentCount: 0, lastSentAt: null, lastFailure: null }} />,
    );
    const line = screen.getByText(/never sent/i);
    expect(line).toHaveClass("text-signal-error");
    expect(line).toHaveTextContent(/not been told/i);
  });

  it("gives the provider's reason when the only attempts failed", () => {
    render(
      <ApprovalMailStatus
        state={{
          sentCount: 0,
          lastSentAt: null,
          lastFailure: { at, detail: "re-send failed: rate limited" },
        }}
      />,
    );
    expect(screen.getByText(/never sent/i)).toBeInTheDocument();
    expect(screen.getByText(/rate limited/)).toBeInTheDocument();
  });

  it("counts the sends and says sent is not arrived", () => {
    render(
      <ApprovalMailStatus state={{ sentCount: 2, lastSentAt: at, lastFailure: null }} />,
    );
    expect(screen.getByText(/sent 2 times, last/i)).toBeInTheDocument();
    expect(screen.getByText(/not that it arrived/i)).toBeInTheDocument();
    expect(screen.getByText(/check spam/i)).toBeInTheDocument();
  });

  it("says once, not 1 times", () => {
    render(
      <ApprovalMailStatus state={{ sentCount: 1, lastSentAt: at, lastFailure: null }} />,
    );
    expect(screen.getByText(/sent once, last/i)).toBeInTheDocument();
  });

  it("keeps a later failure visible beside an earlier success", () => {
    render(
      <ApprovalMailStatus
        state={{
          sentCount: 1,
          lastSentAt: at,
          lastFailure: { at, detail: "re-send failed: down" },
        }}
      />,
    );
    expect(screen.getByText(/sent once/i)).toBeInTheDocument();
    expect(screen.getByText(/latest attempt failed/i)).toHaveClass("text-signal-error");
  });
});
