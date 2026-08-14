import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listAwaitingApproval,
  listBreedRequests,
} from "@/lib/admin/approvals";
import { REVISION_LABELS } from "@/lib/revision";
import { ApprovalQueueActions } from "@/components/admin/ApprovalQueueActions";
import { markForPersonalContact, releaseToPrint } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * What is waiting on somebody.
 *
 * Two lists, deliberately: portraits nobody has approved, and breeds nobody
 * could find. The first is today's work; the second is what to draw next.
 */
export default async function ApprovalsPage() {
  await requireAdmin();
  const [awaiting, requests] = await Promise.all([
    listAwaitingApproval(),
    listBreedRequests(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">Awaiting approval</h1>
          <span className="text-sm text-muted">{awaiting.length} waiting</span>
        </div>

        {awaiting.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing is waiting on anybody. Every paid order has been approved.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {awaiting.map((row) => (
              <li
                key={row.artworkId}
                className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <Link
                      href={`/admin/orders/${row.orderId}`}
                      className="font-display text-lg text-ink underline"
                    >
                      {row.orderRef ?? row.orderId.slice(0, 8)}
                    </Link>
                    <span className="text-sm text-ink">
                      {row.creatureName ?? "No name given"}
                    </span>
                    <span className="text-sm text-muted">
                      {row.productSlug} · {row.firstName} · {row.email}
                    </span>
                  </div>
                  <span className="text-sm text-muted">
                    {formatDate(row.createdAt)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted">
                    {row.revisionCount === 0
                      ? "No revisions"
                      : `${row.revisionCount} revision${row.revisionCount === 1 ? "" : "s"}`}
                  </span>
                  {row.needsPerson ? (
                    // The customer is never shown a count; the owner is, because
                    // this is the screen where somebody picks up the phone.
                    <span className="eyebrow rounded-md bg-btn px-2 py-0.5 text-[11px] text-base">
                      Needs a person
                    </span>
                  ) : null}
                  {row.personalContactAt ? (
                    <span className="text-muted">
                      Marked {formatDate(row.personalContactAt)}
                    </span>
                  ) : null}
                </div>

                {row.standoutDetail ? (
                  // The one sentence the customer wrote that the model was also
                  // given (docs/spec-standout-detail.md). It is here because
                  // this is the screen where somebody decides whether the
                  // portrait is right, and "does it have the flopped ear?" is
                  // not a question you can answer without knowing it was asked.
                  <div className="flex flex-col gap-1 border-t border-line pt-3">
                    <p className="eyebrow text-[11px] text-accent">
                      What stands out about them
                    </p>
                    <p className="rounded-md border border-line bg-base px-3 py-2 text-sm text-ink">
                      {row.standoutDetail}
                    </p>
                  </div>
                ) : null}

                {row.revisions.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    {row.revisions.map((revision, index) => (
                      <div key={index} className="flex flex-col gap-1">
                        <p className="text-sm text-muted">
                          {revision.reasons
                            .map((reason) => REVISION_LABELS[reason])
                            .join(" · ") || "No reason given"}
                        </p>
                        {revision.note ? (
                          // Their own words, verbatim. These have never been
                          // near a prompt and never will be.
                          <p className="rounded-md border border-line bg-base px-3 py-2 text-sm text-ink">
                            {revision.note}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <ApprovalQueueActions
                  artworkId={row.artworkId}
                  alreadyMarked={row.personalContactAt !== null}
                  onRelease={releaseToPrint}
                  onMarkPersonal={markForPersonalContact}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">Breeds people wanted</h2>
          <span className="text-sm text-muted">{requests.length} distinct</span>
        </div>
        <p className="text-sm text-muted">
          What was searched for and not found, commonest first. This is the
          order to draw them in.
        </p>

        {requests.length === 0 ? (
          <p className="text-sm text-muted">Nobody has come up empty yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 font-medium">Searched for</th>
                <th className="py-2 font-medium">Species</th>
                <th className="py-2 text-right font-medium">Asked</th>
                <th className="py-2 text-right font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((row) => (
                <tr
                  key={`${row.species}:${row.query}`}
                  className="border-b border-line"
                >
                  <td className="py-2 text-ink">{row.query}</td>
                  <td className="py-2 text-muted">{row.species}</td>
                  <td className="py-2 text-right text-ink">{row.count}</td>
                  <td className="py-2 text-right text-muted">
                    {formatDate(row.lastAskedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
