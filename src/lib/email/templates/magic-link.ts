import {
  button,
  eyebrow,
  heading,
  paragraph,
  shell,
  type RenderedEmail,
} from "../layout";

export interface MagicLinkData {
  /** Absolute, single-use sign-in link built by the caller. */
  loginUrl: string;
}

/**
 * The passwordless sign-in email: one button that logs you in. There is nothing
 * to remember and nothing to reset, so the copy just reassures (you asked for
 * this, it is one-time, it expires) and gets out of the way. No sender-identity
 * or unsubscribe footer here: this is a transactional login mail the person just
 * asked for, not marketing.
 */
export function magicLinkEmail(data: MagicLinkData): RenderedEmail {
  const body = [
    eyebrow("Sign in"),
    heading("Here is your link into your account."),
    paragraph(
      "Tap the button to sign in and see your creatures and your orders. The link works once and expires in fifteen minutes, so if it lapses just ask for a new one.",
    ),
    button(data.loginUrl, "Sign me in"),
    paragraph(
      "If you did not ask to sign in, you can ignore this mail and nothing happens. The link cannot do anything until it is opened.",
    ),
  ].join("\n");

  const text = [
    "SIGN IN",
    "",
    "Here is your link into your account.",
    "",
    "Open this to sign in and see your creatures and your orders. It works",
    "once and expires in fifteen minutes:",
    data.loginUrl,
    "",
    "If you did not ask to sign in, you can ignore this mail and nothing",
    "happens.",
  ].join("\n");

  return {
    subject: "Your sign-in link",
    html: shell({
      title: "Your sign-in link",
      preheader: "One tap to sign in. The link works once and expires in fifteen minutes.",
      body,
    }),
    text,
  };
}
