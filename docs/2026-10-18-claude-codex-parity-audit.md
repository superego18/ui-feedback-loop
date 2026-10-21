# Claude / Codex CLI Feedback Integration Audit

Date: 2026-10-18. Status: investigation complete; implementation not authorized.

Update 2026-10-19: F02 was later fixed with owner approval, after a Claude session took over
the coordinator role. The project host gained a loopback-only ingress for registered Claude
sessions, and the nested data root was flattened into `.ui-feedback/`. F01 and F03-F10 are unchanged.

## Decision and Scope

- The owner initially requested investigation and fixes, then explicitly narrowed
  the request to investigation only. Subsequent confirmations repeated that limit.
- This report preserves findings for a later implementation or session handoff.
  Recommendations below are proposals, not permission to execute them.
- No implementation, hook/configuration changes, commits, pushes, session-control
  actions or server restarts were performed as part of this audit.
- Evidence combines source inspection, read-only live API/log probes, local CLI
  help, a small in-memory review-watch check and official OpenAI documentation.
- Two registered Codex sessions were inspected. Claude behavior was traced in
  source, not exercised against a running Claude session. This is not a complete
  cross-platform end-to-end certification.

### Source Snapshot

| Component | Commit / version |
|---|---|
| ai-config parent at audit | `5f18d00` |
| ui-feedback-loop | `5850449` |
| agent-chat-widget | `50d77d3` |
| ui-review-page | `c0c8785` |
| Installed Codex CLI | `0.163.0` |
| Audited operating system | Windows; PowerShell 5.1; Node 24.19.0 |

These commits include the earlier delivery-reliability and plain-language label
fixes. Those preceding changes must not be described as fixes made by this audit.

## Reading Guide

- **Observed**: a live read-only probe demonstrated the behavior.
- **Source-confirmed**: the code path establishes a missing or different behavior;
  no live model invocation, push notification or session mutation was needed.
- **Limited reproduction**: an isolated in-memory check, not full UI/agent behavior.
- **Unverified**: implementation exists or a possible remedy is documented, but
  execution was deliberately not attempted during this investigation.

Line references below apply to the snapshot above. Widget paths are relative to
`vendor/agent-chat-widget/`; review-page paths to `vendor/ui-review-page/`.
Keep the named functions when line numbers move.

## Findings

<details>
<summary>F01. Working, permission and idle status have no Codex input adapter</summary>

- **Observed:** both live Codex registrations returned `status.state = unknown`.
  Neither had a `status-<session>.json` file.
- **Observed:** native records contained `task_started`, `task_complete` and
  `turn_aborted`. The coordinator's native turn was active while the widget status
  remained unknown. A read-only assertion against that exact mismatch failed.
- `listSessions()` calls the same file-based `readStatus()` for both agents;
  it does not interpret Codex lifecycle records.
- Claude's `hook-relay.mjs` posts working status on prompt/tool events, idle on
  Stop, and permission status on Notification. The hook installer writes only
  `.claude/settings.local.json` and registers six Claude events.
- Missing status affects launcher dots, tab indicators, typing/activity details,
  approval display, peer activity arrows and work/permission/done/stale alerts.
- Evidence: widget `scripts/chat-handler.mjs:92,126,205,226`;
  `scripts/hook-relay.mjs:80,99,125,130`;
  `scripts/install-hooks.mjs:20-21`;
  `assets/app-widget.js:1121,1181,1573,1718`.
- The global shared hook manifests were empty at the audit. The two local Codex
  homes had no `hooks.json`; this was not an install mismatch with a nonempty
  shared manifest. Existing Codex `notify` configuration was not this UI relay.
- **Proposed:** a Codex lifecycle adapter with explicit unknown/disconnected/error
  handling, plus registration/trust instructions and lifecycle regression tests.
  Choose native hooks or the active app-server transport deliberately; do not
  equate a CLI executable on PATH with a running session.

</details>

<details>
<summary>F02. The validation project's host also blocks status delivery</summary>

- **Observed:** an empty-body POST to the local review host's `/api/status`
  returned HTTP404, `Not in API allowlist`. No session ID/state was supplied and
  no status was changed.
- The project-local `scripts/ux-prototype-host.mjs:107,150-160` omits `/api/status`
  from its write allowlist, requires browser-origin JSON for permitted writes,
  and permits only user-origin chat writes.
- Consequently, adding a common status hook alone would not complete this
  integration. Claude-style hook chat relay would also hit the user-only guard.
- There is an additional path mismatch: the Claude relay searches ancestor
  `<directory>/.ui-feedback/sessions/<id>.json`, while this validation runtime
  registers sessions in `.ui-feedback/workflow-r1/sessions/`. Its existing lookup
  does not discover that nested data root. Verify both discovery and ingress
  before describing a Claude handoff as a working UI connection.
- This is a **project integration boundary**, separate from the common vendor's
  missing Codex adapter. It must not be generalized as a Codex platform defect.
- **Proposed:** define a narrowly authenticated trusted-local-agent ingress while
  retaining the protection against browser/remote agent-status spoofing. Do not
  simply allow arbitrary browser writes or drop the access controls.

</details>

<details>
<summary>F03. Native Codex answers bypass answer-push notifications</summary>

- **Source-confirmed:** `addChat()` emits answer push notifications for stored
  agent messages; `readTranscript()` only returns native records to polling UI.
  It does not pass those answers through the notification path.
- **Observed snapshot:** the two native transcript responses contained 35 and
  40 assistant messages, while their stored `chat.json` agent-message counts
  were both zero. These are point-in-time counts, not durable invariants.
- Codex side-question replies do call `addChat()`, so their notification path
  differs from the main Codex conversation.
- On-screen previews/unread badges have a combined-timeline code path; do not
  describe them as universally broken merely because web push is missing.
- Evidence: widget `scripts/chat-handler.mjs:363,757,776,946`;
  `assets/app-widget.js:1723,1789,1852`.
- **Proposed:** ingest native answers into one deduplicated event/notification
  pipeline. Define startup/history replay behavior and commentary-versus-final
  notification policy before enabling notifications. No real push was sent here.

</details>

<details>
<summary>F04. Native message IDs exclude normal message controls and break link lookup</summary>

- **Observed:** native transcript IDs were strings, with 48/48 and 40/40 unique
  IDs in the initial two responses. The suspected `xundefined` collision was
  **not reproduced**; do not carry it forward as a confirmed bug.
- **Source-confirmed:** reply/reference/copy/pin/message-specific-side-question
  buttons are created only when `typeof m.id === 'number'`.
- Selection lookup also restricts numeric IDs and searches the stored messages
  array rather than the full native-plus-stored timeline. Swipe-to-side-question
  lookup has the same stored-message limitation.
- Backend `replyTo`, quote IDs and `sideOn` validators accept only positive
  integers. Removing only the frontend guard would not finish the feature.
- Link rendering converts DOM IDs with `Number(e.dataset.id)`, so native string
  IDs become NaN and cannot be resolved as the original string endpoints.
- The correct current symptom is **missing UI entry points** for native answers,
  not a claim that a normal native-answer reply was successfully sent and lost.
- Evidence: widget `assets/app-widget.js:694,696,997,1401,3109`;
  `scripts/chat-handler.mjs:309,345,356,808`.
- **Proposed:** a stable, session-namespaced message identity supported by frontend
  lookup, persisted references, backend validation, quotes and link rendering.
  Preserve compatibility with existing numeric stored-message references.

</details>

<details>
<summary>F05. Codex queue payload omits quote/reference and resend context</summary>

- **Source-confirmed:** Claude delivery uses `formatMessage()` to attach quoted
  originals, partial quote text, reference-versus-reply meaning and resend links.
- Codex `queueToCodex()` builds a separate prompt from source/receipt, message
  text and location/adjustment. It does not serialize those quote relationships.
- This also affects otherwise valid numeric references to stored widget messages;
  it is distinct from the missing native-answer buttons in F04.
- Explicit numeric `<re ...>` answer markers are parsed by `addChat()` but are
  not normalized by the native `readTranscript()` path. The Codex queue prompt
  does not supply the widget message number as Claude's formatted message does.
  Exact cross-path answer linking needs a dedicated regression scenario.
- Evidence: widget `scripts/chat-format.mjs:20-40`;
  `scripts/chat-handler.mjs:333,663-671,805-808`.
- **Proposed:** one structured semantic formatter with transport-specific receipt
  wrapping; preserve the receipt pickup contract rather than replacing it.

</details>

<details>
<summary>F06. Interject, cancel send and move-unread-to-hold are explicitly disabled for Codex</summary>

- **Source-confirmed support difference:** Codex is excluded in the UI and rejected
  in the cancel/interject endpoints, even before a native pickup is observed.
- This is not fixed by making status say working. Claude uses PostToolUse context
  injection, while Codex currently submits a new queued turn.
- Moving an unread sent message to hold depends on cancellation and is therefore
  also unavailable on this path. Unsent held notes are a separate common feature.
- Evidence: widget `assets/app-widget.js:1467,1481,1696`;
  `scripts/chat-handler.mjs:1145,1167`;
  `scripts/hook-relay.mjs:105`.
- **Proposed:** assess active-turn steering separately from queued-next-turn input.
  Cancellation requires an actual backend capability and truthful race handling;
  do not implement a cosmetic cancellation after possible delivery.

</details>

<details>
<summary>F07. Stop, compact and terminal wake depend on cmux rather than agent capability</summary>

- **Observed registration:** neither inspected session had cmux surface metadata;
  the API returned `compact: false` for both.
- **Source-confirmed:** stop/compact require that surface and send Esc or
  `/compact` plus Enter through cmux. There is no ordinary Windows terminal or
  Desktop replacement in this adapter. Current Codex stop display is additionally
  special-cased because its status is unknown.
- Claude automatic watcher wake is also cmux-dependent. Codex explicitly skips
  that wake path and instead relies on queue submission.
- Evidence: widget `scripts/register-session.mjs:101`;
  `scripts/chat-handler.mjs:379,391,1055-1084`;
  `assets/app-widget.js:1130`.
- **Proposed:** capability-based controls for the actual target runtime. Official
  app-server methods exist, but safely attaching to the existing session host and
  proving completion is required; their existence is not live verification.

</details>

<details>
<summary>F08. Review auto-continue status can select another session's watcher</summary>

- **Source-confirmed / limited reproduction:** `readReviewWatch()` returns the
  first active done-capable watcher matching the round before resolving the
  requested `sessionKey`. The watcher need not belong to the target session.
- A Codex-target review can therefore advertise another Claude session's watcher
  and its stronger auto-continue wording. Actual message misdelivery was **not**
  demonstrated. This is a shared multi-session bug, not Codex-only.
- Queue availability is currently executable/configuration detection, not proof
  of a loaded/running recipient. The prior wording release correctly avoids a
  promise of immediate execution for the queue-specific path.
- Standalone ui-review-page intentionally stores ratings without providing the
  parent chat/auto-delivery integration; both agents need the integrated host.
- Evidence: widget `scripts/chat-handler.mjs:67,838-850`;
  parent `scripts/review-server.mjs:26`;
  review `assets/review-page.js:569`, `scripts/review-server.mjs:19`.
- **Proposed:** resolve the target first, then require matching session and round
  for watcher claims. Keep configured, submitted, picked-up and executing distinct.

</details>

<details>
<summary>F09. Transcript rendering discards phase and has different history limits</summary>

- **Source-confirmed:** native records contain commentary/final-answer phase
  metadata, but the returned transcript item omits it. Those messages are rendered
  without that distinction. This affects any later final-answer notification rule.
- Codex transcript reads are capped at the final4MiB, final300 returned messages,
  and8,000 characters per message. Claude hook ingestion is a separate path with
  different limits; it is not unlimited, either.
- User native records beginning with `<`, queue-prefixed input, or containing
  `AGENTS.md instructions` are filtered. Some legitimate user text can match this
  broad filter. A proper fix must still exclude injected instructions/duplicates.
- The native reader handles message records, not tool calls/results. Claude also
  does not present full tool results through this UI; it supplies tool activity
  labels through hooks. Do not classify full tool-output absence as Codex-only.
- Evidence: widget `scripts/chat-handler.mjs:39,789,805-810`;
  `scripts/hook-relay.mjs:99,136`.
- **Proposed:** preserve phase metadata, document/paginate history boundaries, and
  separate provenance-based filtering from raw user-content heuristics.

</details>

<details>
<summary>F10. Peer/subagent presentation and context usage differ by source</summary>

- Claude hook code explicitly creates peer and subagent chat records and peer
  status links. Native Codex transcript handling only extracts user/assistant
  message records and does not provide the equivalent structured presentation.
- The audit did not claim that every peer notification disappears; the exact
  displayed result depends on the native record shape and needs a fixture.
- Context percentage is implemented for Codex using the latest token_count input
  usage divided by the context window, marked `approx: true`. Claude uses a
  statusline file. Different measurement provenance is not itself a defect.
- Evidence: widget `scripts/hook-relay.mjs:86-102`;
  `scripts/chat-handler.mjs:98-122,805-808`.
- **Proposed:** preserve provenance and distinguish parent work, subagent work and
  peer delivery; never infer session readiness solely from context file changes.

</details>

## Existing Paths and Deliberately Unverified Behavior

| Capability | What was established | Limit |
|---|---|---|
| Codex send/retry | Native CLI invocation and durable delivery states exist | Earlier release evidence, not a fresh send during this audit |
| Read / pickup | Explicit receipt in the registered native user record is distinct from CLI acceptance | Native transcript tail is bounded; previous pickup timestamps persist |
| Text/value adjustments | Shared location/adjustment formatting reaches queue payload | Do not conflate this with quote/reference context |
| Draft box, compose, preferences, ratings | Shared persistence/UI paths exist | Not exhaustively re-clicked during this audit |
| On-screen unread/peek | Combined native/stored timeline is used | Not proof that phone web push works |
| Generic side question / follow-up | Claude fork/resume and Codex exec fork/resume paths exist | No real model call, fork or sandbox efficacy test here |
| Queue availability | Installed0.163.0 help exposes `queue`; configured source can invoke it | Does not prove recipient live state or every Desktop host |
| Windows / macOS | Windows source/live reads inspected; macOS spawn branches traced | No macOS runtime verification |

The comparison display suite passed9/9 in a supporting read-only audit. That suite
checks wording/state presentation, not live agent activity or successful continuation.
No new full widget suite was run, and no comprehensive GUI parity result is claimed.

## Reproduction Notes

<details>
<summary>Read-only probes and expected signals</summary>

Use the existing owned local review service and registered paths. Supply local
values rather than putting an access key, private hostname or personal ID in a
portable report. Never POST a real status to make the UI look correct.

1. GET `/api/sessions`: capture only tool, status state and capability fields.
2. Read the registered session's native JSONL, inspecting event type/timestamp only.
   Compare task_started against task_complete/turn_aborted; exclude text/secrets.
3. While that registered native turn is active, assert its UI status is not unknown.
   The actual audit observed `nativeTurnActive: true, widgetStatus: unknown` and
   the assertion failed, reproducing the owner's reported missing activity state.
4. GET `/api/transcript?session=<registered-id>`: count items and distinct IDs.
   Initial observed counts were48/48 and40/40, disproving an xundefined claim.
5. Compare native assistant counts with stored agent-message counts without
   printing message bodies. Inspect the separate push call sites.
6. For the project's host boundary only, POST an empty `{}` to `/api/status`.
   The observed404 `Not in API allowlist` changed no status. Do not supply a
   fabricated session/state or loosen the host to perform this probe.
7. Source-check numeric-ID guards, integer quote validation and native link-ID
   conversion. Do not send test messages into real user conversations to prove it.

PowerShell5.1 note from preceding work: Korean here-strings piped into Node can
be replaced with question marks unless OutputEncoding is UTF-8. Use ASCII probe
source or set encoding explicitly before comparing Korean native text. This was
a test-harness pitfall, not evidence that every application payload is corrupted.

</details>

## Official Capability Check

- [Codex hooks](https://learn.chatgpt.com/docs/hooks) documents lifecycle/tool/prompt,
  permission, stop and interrupt events; user/project hook locations; and the
  requirement to review/trust non-managed hook definitions.
- [Codex app-server](https://learn.chatgpt.com/docs/app-server) documents
  `thread/status/changed`, `turn/started`, `turn/completed`, `turn/steer`,
  `turn/interrupt` and `thread/compact/start`.
- Local0.163.0 `codex --help`, `codex queue --help` and `codex exec --help`
  were read. Queue and exec fork/resume are exposed by the installed CLI.
- Therefore the skill's blanket statement that Codex has no hooks is outdated as
  a platform claim. The verified claim is that **this tool's Codex integration
  does not wire the corresponding hooks/capabilities**.
- Official API availability does not prove compatibility with the current loaded
  session transport, hook trust configuration or another version/OS. No trust or
  permission bypass was enabled for this investigation.

## Proposed Follow-Up, Not Authorization

1. Define the common lifecycle/event input and secure project-host integration;
   validate working, idle, approval, interrupt, failures and notification deduping.
2. Normalize message identity and semantic quote/reply formatting across transports;
   validate native controls, partial quotes, links and historical references.
3. Fix target-specific watcher selection and expose real session-control capabilities;
   validate queue/steering/cancel boundaries rather than promising identical behavior.
4. Preserve phase/provenance and define long-history behavior, then run the complete
   widget/review suites plus focused real Windows/Claude/Codex integration checks.

The current owner boundary is still investigation and documentation only. Obtain a
new implementation request before changing code, installing hooks, registering a
replacement session, sending probes to real sessions, restarting services or publishing.
