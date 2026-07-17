import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

/** Routes that used to be linked but were never pages. None may reappear. */
const DEAD_ROUTES = ["/shop", "/how-it-works", "/track"];

const appDir = resolve(process.cwd(), "src/app");

/** The page-file path an internal href resolves to, ignoring any #fragment. */
function pageDirFor(href: string): string {
  const path = href.split("#")[0] || "/";
  return path === "/" ? appDir : resolve(appDir, `.${path}`);
}

function hasPageFile(href: string): boolean {
  const dir = pageDirFor(href);
  return (
    existsSync(resolve(dir, "page.tsx")) || existsSync(resolve(dir, "page.ts"))
  );
}

function internalHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/")); // skip mailto:, external, "#"
}

describe("nav links resolve", () => {
  it("renders the four primary nav items", () => {
    render(<Nav />);
    for (const label of ["Shop", "How it works", "Our story", "FAQ"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("points no nav link at a route that does not exist", () => {
    const { container } = render(<Nav />);
    for (const href of internalHrefs(container)) {
      expect(DEAD_ROUTES).not.toContain(href);
      expect(hasPageFile(href), `nav link "${href}" has no page file`).toBe(
        true,
      );
    }
  });

  it("no longer offers a dead Track order link", () => {
    render(<Nav />);
    expect(
      screen.queryByRole("link", { name: /Track order/ }),
    ).not.toBeInTheDocument();
  });

  it("sends Shop and How it works to the landing sections", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute(
      "href",
      "/#range",
    );
    expect(
      screen.getByRole("link", { name: "How it works" }),
    ).toHaveAttribute("href", "/#how-it-works");
  });
});

describe("footer links resolve", () => {
  it("points no internal footer link at a route that does not exist", () => {
    const { container } = render(<Footer />);
    for (const href of internalHrefs(container)) {
      expect(DEAD_ROUTES).not.toContain(href);
      expect(hasPageFile(href), `footer link "${href}" has no page file`).toBe(
        true,
      );
    }
  });
});
