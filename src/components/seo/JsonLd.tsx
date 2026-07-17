import type { JsonLd as JsonLdObject } from "@/lib/seo/jsonld";

/**
 * Renders one or more JSON-LD nodes into a <script type="application/ld+json">.
 *
 * The `<` escape is not decoration: JSON.stringify happily emits a literal
 * `</script>` if any string in the graph contains one, which closes the tag
 * early and hands the rest of the payload to the HTML parser. Escaping `<` to
 * its unicode form is the sanitisation the Next.js JSON-LD guide prescribes.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <>
      {payload.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
