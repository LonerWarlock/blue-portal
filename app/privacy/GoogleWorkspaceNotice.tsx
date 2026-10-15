const services = [
  {
    name: "Gmail",
    scope: "gmail.modify",
    data: "Message identifiers, headers (including senders and recipients), and message bodies retrieved for your request.",
    actions: "Search and read messages, archive a message, or move it to Trash after approval. Blue does not currently provide an email-sending tool.",
  },
  {
    name: "Google Drive",
    scope: "drive",
    data: "File names, identifiers, types, links, modification times, and supported Google Docs, Sheets, and Slides exports.",
    actions: "Search files; read supported exports; create folders and plain-text files; replace plain-text content; rename, move, or trash files after approval. Moving a file can change who can access it through inherited folder permissions. Blue does not edit Docs or Sheets contents, permanently delete files, or directly change sharing permissions.",
  },
  {
    name: "Google Calendar",
    scope: "calendar",
    data: "Calendar information, event details, attendee information, and invitation responses returned for your request.",
    actions: "List calendars, read events, and accept, decline, or tentatively accept an existing invitation after approval. Invitation responses can notify other attendees. This is not a general calendar-administration integration.",
  },
  {
    name: "Google Contacts",
    scope: "contacts.readonly",
    data: "Contact names, email addresses, and phone numbers returned for your request.",
    actions: "Read contacts to help answer your request. This integration does not create, edit, or delete contacts.",
  },
  {
    name: "Google Tasks",
    scope: "tasks",
    data: "Task-list information and task details, including titles, notes, due dates, and completion status.",
    actions: "Read lists and tasks; create lists and tasks; edit, complete, reopen, or delete individual tasks after approval. Blue does not provide bulk clearing or task-list deletion.",
  },
];

export default function GoogleWorkspaceNotice() {
  return (
    <section id="google-workspace" aria-labelledby="google-workspace-title" className="scroll-mt-24 space-y-6 border-y border-line py-8">
      <div>
        <p className="eyebrow mb-3">Optional Blue Desktop connection</p>
        <h2 id="google-workspace-title" className="text-2xl font-bold text-ink">Google Workspace privacy</h2>
        <p className="mt-2 text-xs text-ink-muted">Notice updated: <time dateTime="2026-10-15">15 October 2026</time></p>
        <p className="mt-4 text-sm text-ink-muted leading-relaxed">
          This section applies when you choose to connect a Google account in Blue Desktop. It is separate from signing in to your Blue account and from website payment, event, and analytics services described below. You can use Blue without connecting Google Workspace.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ink mb-3">What you authorize and why</h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          Connect opens Google authorization in your system browser. The current integration requests the five permissions below together; you choose what to grant on Google&apos;s consent screen, and Blue exposes only the tools covered by your grant. Blue uses retrieved information to answer your requests and perform the supported productivity tasks you ask it to carry out. Google changes go through Blue&apos;s action-approval flow, including in voice mode; connecting alone does not approve every change.
        </p>
        <dl className="mt-5 space-y-4">
          {services.map(service => (
            <div key={service.scope} className="rounded-lg bg-paper-alt border border-line p-4">
              <dt className="font-semibold text-ink">{service.name}</dt>
              <dd className="mt-2 text-sm text-ink-muted leading-relaxed space-y-2">
                <p>{service.data}</p>
                <p>{service.actions}</p>
                <p className="text-xs text-ink-muted">Requested permission: <code className="break-all">https://www.googleapis.com/auth/{service.scope}</code></p>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div id="google-ai-processing" className="scroll-mt-24 rounded-lg border border-brand/30 bg-brand/5 p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-ink mb-3">AI processing and third-party providers</h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          Google content retrieved for a request can be included in prompts, tool results, and conversation context sent through your configured AI engine, model gateway, and underlying model provider. For example, asking Blue to summarize an email or document can send its retrieved contents to that provider. Running the coding engine on your computer does not mean AI processing stays on your device.
        </p>
        <p className="mt-3 text-sm text-ink-muted leading-relaxed">
          The receiving services depend on your selected engine, model, and provider connection. Model providers and gateways have their own privacy, retention, and data-use terms; Blue does not promise identical no-training or zero-retention terms across every selectable provider. Review those terms before asking Blue to use sensitive Google content. OAuth access and refresh tokens are kept out of model prompts and tool results.
        </p>
        <p className="mt-3 text-sm text-ink-muted leading-relaxed">
          Website analytics, advertising, and payment services are not recipients of Google content through this connector. Google API data handling is subject to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-brand hover:underline">Google API Services User Data Policy, including its Limited Use requirements</a>. This notice is not a claim that Google has verified or certified Blue.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ink mb-3">Storage, retention, and security</h3>
        <ul className="list-disc pl-5 text-sm text-ink-muted leading-relaxed space-y-3">
          <li>Google access and refresh tokens are stored locally in Blue&apos;s encrypted credential store, associated with the current Blue account. The connector uses them to make authorized Google API requests.</li>
          <li>Retrieved content and answers derived from it can remain in local Blue conversation state or the coding engine&apos;s own history. Ordinary conversation state is not encrypted by Blue&apos;s credential-store mechanism. Device access and any device backups can therefore affect who can read those histories.</li>
          <li>There is no fixed automatic deletion period for these local histories. Model gateways and providers can retain copies under their own terms; local deletion cannot guarantee deletion of those copies.</li>
          <li>Google API requests use HTTPS. Encrypted local credentials and transport encryption are not a claim that all conversation data is encrypted at rest or end-to-end encrypted from the model provider.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ink mb-3">Disconnect, revoke access, and request deletion</h3>
        <ol className="list-decimal pl-5 text-sm text-ink-muted leading-relaxed space-y-3">
          <li>In Blue, open Connections, find Google Workspace, and choose Disconnect. This removes that Blue account&apos;s saved Google credentials on this device and stops new connector requests. It does not undo a Google action already accepted or completed.</li>
          <li>To revoke Google&apos;s authorization as well, open <a href="https://myaccount.google.com/connections" className="text-brand hover:underline">your Google Account&apos;s third-party connections</a>, select Blue, and remove its access. Disconnecting inside Blue alone does not perform this Google-side revocation.</li>
          <li>Delete affected conversations in Blue to remove their visible application messages and associated application attachments. This does not guarantee deletion of separate coding-engine histories, backups, Google originals, or provider-held copies. Manage those separately with the relevant service.</li>
          <li>For help with data access or deletion involving information held by IMERGENE, email <a href="mailto:team.imergene@gmail.com" className="text-brand hover:underline">team.imergene@gmail.com</a>. Do not include passwords, access tokens, or private message contents in your initial request.</li>
        </ol>
      </div>
    </section>
  );
}
