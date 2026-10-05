export default function JsonLd({ data }: { data: unknown }) {
  // Escape HTML delimiters so content cannot close the JSON script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
