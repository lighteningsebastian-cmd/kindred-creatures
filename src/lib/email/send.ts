/**
 * The email transport seam.
 *
 * Same shape as src/lib/images/index.ts and payfast.ts: an interface, a mock
 * that needs no credentials, a real implementation behind an env var, and one
 * function that picks between them. A developer who has cloned the repo and set
 * nothing at all still gets working sends, printed to the console.
 *
 * HOW FAILURE SURFACES. `EmailTransport.send` THROWS `EmailSendError` when a
 * message cannot be handed off. That is deliberate and it is the low-level
 * contract: the transport knows the send failed and refuses to pretend
 * otherwise. Callers that must not fail because of email (the ITN webhook, in
 * particular) should use the helpers in ./index.ts, which catch and return a
 * discriminated result instead. Nothing in here swallows an error quietly, so
 * an order can never be lost to a mailbox being down.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a human reply should land. The job sheet sets this to our address. */
  replyTo?: string;
}

export interface EmailTransport {
  /**
   * Hands the message to the provider.
   *
   * @returns the provider's message id, for logging and support lookups.
   * @throws {EmailSendError} if the provider rejects it or is unreachable.
   */
  send(message: EmailMessage): Promise<{ id: string }>;
}

/**
 * A send that did not happen. `cause` keeps the provider's own error for logs.
 * The message is safe to log: it names the recipient and the subject, never a
 * key, because the only secret in play is RESEND_API_KEY and it never comes
 * near this object.
 */
export class EmailSendError extends Error {
  readonly to: string;
  readonly subject: string;

  constructor(message: EmailMessage, reason: string, options?: ErrorOptions) {
    super(`Could not send "${message.subject}" to ${message.to}: ${reason}`, options);
    this.name = "EmailSendError";
    this.to = message.to;
    this.subject = message.subject;
  }
}

/** True when we should log emails rather than send them. */
export function usingMockEmail(): boolean {
  return process.env.MOCK_SERVICES === "true" || !process.env.RESEND_API_KEY;
}

/**
 * The From address. A verified sending domain is a Resend account setting, so
 * this has to be configurable; the default is the address we intend to verify
 * and it keeps the mock path readable before anyone has configured anything.
 */
export function emailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Kindred Creatures <hello@kindredcreatures.co.za>"
  );
}

/** Our own human address, used as the default Reply-To on the job sheet. */
export function emailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || "hello@kindredcreatures.co.za";
}

// ---------------------------------------------------------------------------
// Mock transport
// ---------------------------------------------------------------------------

let mockCounter = 0;

/**
 * Logs the message and pretends it went. This is the whole of what a developer
 * without a key sees, so the log is written to be read: the plain-text body is
 * printed in full, because the text half of every template is the same content
 * as the HTML half and a job sheet is meant to be eyeballed here.
 */
export class MockEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const id = `mock-email-${++mockCounter}`;
    const reply = message.replyTo ? `\nReply-To: ${message.replyTo}` : "";
    const summary = [
      "",
      "=== email (mock transport, nothing was sent) ===",
      `From:    ${emailFrom()}`,
      `To:      ${message.to}`,
      `Subject: ${message.subject}${reply}`,
      `Id:      ${id}`,
      "---",
      message.text,
      "=== end email ===",
      "",
    ].join("\n");
    console.log(summary);
    return { id };
  }
}

// ---------------------------------------------------------------------------
// Resend transport
// ---------------------------------------------------------------------------

/**
 * Real sends via Resend. The SDK is imported on first send and the client is
 * built then, never at module load: importing this file must stay free, because
 * getEmailTransport() is called on paths that mostly run in mock mode. The key
 * is read at construction time and lives only inside the client.
 */
export class ResendEmailTransport implements EmailTransport {
  private clientPromise: Promise<{
    emails: {
      send(payload: Record<string, unknown>): Promise<{
        data: { id: string } | null;
        error: { message: string } | null;
      }>;
    };
  }> | null = null;

  private client() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      // Unreachable through getEmailTransport(), which checks first. Worth a
      // real error anyway: constructing this class directly without a key is a
      // bug, and a silent no-op would hide it.
      throw new Error("RESEND_API_KEY is not set. Cannot send email.");
    }
    if (!this.clientPromise) {
      this.clientPromise = import("resend").then(
        ({ Resend }) => new Resend(apiKey) as never,
      );
    }
    return this.clientPromise;
  }

  async send(message: EmailMessage): Promise<{ id: string }> {
    // Deliberately outside the try below: a missing key or an unloadable SDK is
    // a configuration or packaging fault, not a send that failed, and dressing
    // it up as one would have callers logging "email is down" at a typo.
    const resend = await this.client();

    let result;
    try {
      result = await resend.emails.send({
        from: emailFrom(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });
    } catch (cause) {
      // Network, DNS, an SDK throw. Never let the raw error escape untyped:
      // a rejected promise from deep inside an SDK is what callers forget to
      // handle, and this layer's whole job is being handleable.
      throw new EmailSendError(message, "the provider could not be reached", {
        cause,
      });
    }

    // Resend reports rejection in `error` rather than by throwing, so a failed
    // send looks exactly like a successful one unless this is checked.
    if (result.error) {
      throw new EmailSendError(message, result.error.message);
    }
    if (!result.data?.id) {
      throw new EmailSendError(message, "the provider returned no message id");
    }
    return { id: result.data.id };
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

let cached: EmailTransport | null = null;

/**
 * Returns the active transport: the mock when MOCK_SERVICES is truthy or no
 * RESEND_API_KEY is set, otherwise Resend. Mirrors getImageProvider().
 */
export function getEmailTransport(): EmailTransport {
  if (cached) return cached;
  cached = usingMockEmail()
    ? new MockEmailTransport()
    : new ResendEmailTransport();
  return cached;
}

/** Drops the memoised transport. Tests use this when they change the env. */
export function resetEmailTransport(): void {
  cached = null;
}
