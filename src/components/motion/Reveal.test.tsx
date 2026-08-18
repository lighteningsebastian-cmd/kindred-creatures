import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { Reveal } from "./Reveal";

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * `useReducedMotion()` answers null on the server and true in a browser with
 * Reduce Motion switched on. Reveal used to branch on it during the first
 * render, so the server sent `opacity: 0` markup waiting to be scrolled into
 * view while the client rendered the static, unanimated element. React does
 * not patch up style mismatches during hydration, so the zero opacity stayed
 * on the element with nothing left that would ever raise it: the entire home
 * page below the hero, and the entire shop, rendered blank — for exactly the
 * people who had asked for less motion.
 *
 * A client-only render cannot catch this. It takes a real server render
 * followed by a real hydration, with the preference differing between the two,
 * which is what the world does.
 */
let prefersReduced = false;

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => prefersReduced };
});

beforeEach(() => {
  prefersReduced = false;
});

function serverThenHydrate(): HTMLElement {
  // The server has no preference to read, so it renders the animated path.
  prefersReduced = false;
  const container = document.createElement("div");
  container.innerHTML = renderToString(
    <Reveal>
      <p>the range</p>
    </Reveal>,
  );
  document.body.appendChild(container);

  // The browser does have one, and it says reduce.
  prefersReduced = true;
  act(() => {
    hydrateRoot(
      container,
      <Reveal>
        <p>the range</p>
      </Reveal>,
    );
  });

  return container.firstElementChild as HTMLElement;
}

describe("Reveal, hydrated by a viewer who prefers reduced motion", () => {
  it("leaves the content visible rather than stranded at zero opacity", () => {
    const revealed = serverThenHydrate();
    expect(revealed).not.toBeNull();
    // The assertion that would have caught a blank home page.
    expect(revealed.style.opacity).not.toBe("0");
  });

  it("does not leave the entrance transform on the element either", () => {
    // A surviving translateY(16px) would nudge every section down the page
    // with nothing to animate it back.
    const revealed = serverThenHydrate();
    expect(revealed.style.transform ?? "").not.toMatch(/translateY\(\s*16/);
  });
});
