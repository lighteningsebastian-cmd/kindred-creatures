// @vitest-environment node
import { createHmac, randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  verifyResendWebhook,
  WEBHOOK_TOLERANCE_SEC,
} from "./resend-webhook";

/**
 * The signature scheme, driven from an independent construction in the test:
 * every signature here is built with raw node crypto against the documented
 * Svix scheme (HMAC-SHA256, base64, over "id.timestamp.payload", keyed by the
 * base64 after "whsec_"), so a bug that warped both sides equally cannot pass.
 */

const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW_MS = 1_753_264_800_000; // a fixed clock; the tests own time

function sign(
  payload: string,
  id: string,
  timestampSec: number,
  key: Buffer = KEY,
): string {
  const mac = createHmac("sha256", key)
    .update(`${id}.${timestampSec}.${payload}`)
    .digest("base64");
  return `v1,${mac}`;
}

function freshTimestamp(): number {
  return Math.floor(NOW_MS / 1000);
}

const PAYLOAD = '{"type":"email.delivered","data":{"email_id":"abc"}}';

describe("verifyResendWebhook", () => {
  it("accepts a genuinely signed, fresh webhook", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(true);
  });

  it("accepts when one of several space-separated signatures is genuine", () => {
    const ts = freshTimestamp();
    const bogus = `v1,${randomBytes(32).toString("base64")}`;
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: `${bogus} ${sign(PAYLOAD, "msg_1", ts)}`,
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(true);
  });

  it("rejects an unsigned request", () => {
    const ok = verifyResendWebhook(
      PAYLOAD,
      { id: null, timestamp: null, signature: null },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a wrong signature", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: `v1,${randomBytes(32).toString("base64")}`,
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a signature made with somebody else's secret", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts, randomBytes(24)),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a tampered payload under a genuine signature", () => {
    const ts = freshTimestamp();
    const tampered = PAYLOAD.replace("delivered", "bounced");
    const ok = verifyResendWebhook(
      tampered,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a tampered id: the id is part of what was signed", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_2",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a stale timestamp: the replay window is real", () => {
    const ts = freshTimestamp() - WEBHOOK_TOLERANCE_SEC - 1;
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects a far-future timestamp too", () => {
    const ts = freshTimestamp() + WEBHOOK_TOLERANCE_SEC + 1;
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("accepts inside the tolerance window", () => {
    const ts = freshTimestamp() - WEBHOOK_TOLERANCE_SEC + 30;
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(true);
  });

  it("rejects a non-numeric timestamp", () => {
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: "yesterday",
        signature: sign(PAYLOAD, "msg_1", freshTimestamp()),
      },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects unknown signature versions rather than guessing at them", () => {
    const ts = freshTimestamp();
    const genuine = sign(PAYLOAD, "msg_1", ts);
    const rebadged = `v2,${genuine.slice(3)}`;
    const ok = verifyResendWebhook(
      PAYLOAD,
      { id: "msg_1", timestamp: String(ts), signature: rebadged },
      SECRET,
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("rejects an empty or undecodable secret", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      "whsec_",
      NOW_MS,
    );
    expect(ok).toBe(false);
  });

  it("accepts a secret without the whsec_ prefix: the prefix is cosmetic", () => {
    const ts = freshTimestamp();
    const ok = verifyResendWebhook(
      PAYLOAD,
      {
        id: "msg_1",
        timestamp: String(ts),
        signature: sign(PAYLOAD, "msg_1", ts),
      },
      KEY.toString("base64"),
      NOW_MS,
    );
    expect(ok).toBe(true);
  });
});
