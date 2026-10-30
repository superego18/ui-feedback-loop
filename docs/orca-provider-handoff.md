# Orca provider handoff with widget continuity

Use this guide when an existing widget role moves from Claude to Codex in Orca, or when the same Codex thread acquires a new terminal handle. The widget role is the conversation's stable home; the provider thread and Orca terminal are its current execution targets.

This is a reconnection procedure, not permission to resume the original Claude session, change a provider profile, restart another owner's server, or deploy product code. Keep the original provider transcript read-only. Use the project's existing runtime controls; the generic review server is not a replacement for a project-owned host.

## 1. Establish the current identities and preserve state

- Locate the project's actual widget data root and current registration, server owner, start options, provider home/profile, ports and app/review addresses. Use the existing data root, even when the terminal now starts in a child worktree or the skill repository. Do not create a second empty `.ui-feedback` beside the new cwd.
- Retain the exact existing widget `name` for the role. Orca tab title, provider thread title and widget role name are separate identities; follow the owner's existing title convention without changing the role to create a new tab.
- Use the available Orca CLI guide and terminal inventory to verify the current terminal handle and thread. Handles are runtime-scoped. A title or `agentIdentity: codex` alone cannot distinguish multiple Codex threads.
- Privately back up the existing widget root, including registrations, chat, drafts/holds/trash, compose state, preferences, seen/delivered evidence, peer mappings, `transcript-history`, `native-reference-ids.json`, review data and local authentication state. Record representative message IDs/text, draft state, references and the mobile address for comparison. Never put this backup or credentials in the shared skill repository.

Done when the target thread, existing role, data root and runtime owner are identified, and the pre-handoff state can be compared or restored.

## 2. Reconnect the role from the receiving Codex session

If the existing registration already identifies the verified current thread and terminal and the owned runtime is healthy, keep it and proceed to the existing test's delivery evidence. Re-registration or a restart is not required just to repeat verification.

Create a fresh literal marker of at least eight characters in the receiving session's own tool call. Do not share it with other sessions before discovery, reuse an old marker, or hide it in a shell variable. A marker present in another session's record can select the wrong transcript.

Replace the placeholders with verified values and run this from the receiving Codex session:

```text
node "<skill>/scripts/register-session.mjs" --dir "<existing-widget-root>" --name "<existing-role-name>" --agent Codex --tool codex --port <existing-review-port> --orca-terminal <verified-current-handle> --marker "<fresh-literal-created-here>"
```

Coordinate same-name replacement with the runtime owner: stop only the owned feedback runtime if its migration guard requires it, register the replacement, then restart with the original options and verified provider home. Preserve proxy/LAN authentication and the existing mobile URL; do not replace a project-owned host with another generic server or change Tailscale mappings as a reconnection shortcut.

Same-name registration migrates the role's widget-owned state and backs changed stores up under `session-migrations/`. Do not delete the old registration first or hand-rewrite IDs in chat/drafts. Details and capture limits: [widget session continuity](../vendor/agent-chat-widget/docs/session-continuity.md). Only already captured conversation history can be preserved; retain the provider files until coverage is verified.

Open the resulting registration and inspect the selected native rollout's `session_meta.id` and `cwd`. Verify they identify the intended current thread and workspace, allowing for an intentional Orca child-worktree cwd. A successful registration command or familiar role name is insufficient.

Done when the same role points to the verified new native thread and terminal, and the owned runtime responds at the original addresses.

## 3. Verify delivery through the server's actual provider profile

The shell that discovers a rollout and the server process that invokes `codex queue` may use different provider homes. Inspect both. Do not assume the default is `.codex`, `.codex-chanju`, or the profile used by another session. Preserve the intended profile; if the runtime is using the wrong one, coordinate its explicit correction within the authorized connection scope. Do not edit shared/global configuration to mask the mismatch.

This widget's Codex integration uses the queue path, not Claude hooks or `wait-review`. Do not start the original Claude session or a Claude watcher to make the Codex tab appear connected. Codex replies normally; a second `chat-reply` submission duplicates the answer.

Use one owner-authorized connection test with a unique receipt and check these separate facts:

| Evidence | What it establishes |
| --- | --- |
| `GET /api/sessions`: `watch.via=queue`, `configured=true` | A queue CLI is configured, not native pickup or a running turn. |
| Queue result `accepted` | The CLI accepted/completed its request, not proof the target received it. |
| Exact `[uifb-receipt:…]` in the registered target's native `response_item` → `message`, `role=user`, `content` item `type=input_text` | That individual request reached the intended native thread. Quoted receipts, assistant text and unrelated later inputs do not qualify. |
| Current thread responds and `/api/transcript?session=<new-id>` plus the same widget role show its answer once | The response path and role display work. |

When the owner authorizes a confirm-only test, confirm receipt without editing files or echoing/reposting the test into the widget. For `failed` versus `unknown`, use the [reliable delivery contract](../vendor/agent-chat-widget/docs/reliable-delivery.md). An unknown result may already have arrived: inspect native evidence before any retry; never create a fresh duplicate on silence. Orca terminal-send receipts are a separate transport and their `accepted` status likewise does not establish a started native turn.

Done when one exact receipt is found in the intended native input, the current session answers, and the same role displays that answer once. Otherwise report the specific unverified boundary rather than declaring connection success.

## 4. Check continuity in the owner's working view

- Compare the pre-handoff message IDs/text and captured older history. Check another role tab as well: replacing one role must not hide the others' conversations.
- Verify drafts, holds and trash remain under the same role and categories. Inspect restore behavior without sending held/archived items or deleting real content as a test.
- With an authorized test, check a reply with a partial quotation and a reference-only attachment: distinguish reply from reference, inspect native queued context, and confirm each original remains reachable. Native chips use short aliases while queued references retain the full message ID; keep `native-reference-ids.json` with the widget state.
- Open the existing mobile address at 390px and desktop at 1440px. Confirm the correct role is selected, the original messages/drafts appear, chips are readable, and a refresh retains the intended state. A different selected role can look like lost history. Do not claim visual parity from shared CSS alone; measure the requested original baseline.

Done when the same role, preserved content, references, response path and existing mobile address pass their checks. Keep any unverified item explicitly pending. Record the target/profile and evidence privately, without secrets or machine-specific IDs in this reusable guide.

## Diagnosing missing peer colors after handoff

Orca messages need a verified sender/recipient binding; a name prefix is insufficient. Same-thread re-registration with `--orca-terminal` retains prior handles with an `until` cutoff. Initial historical bindings need independent evidence before adding them; do not infer them from tab titles.

The widget can classify one native input containing ordered sends from the same registered sender when the entire input is covered. Successful execution receipts support bounded queued delays; PowerShell escapes such as backtick-n are decoded before matching. The exact matching and retention rules live in [widget session continuity](../vendor/agent-chat-widget/docs/session-continuity.md).

For a missed color, compare the actual send command, recipient handle at send time, execution receipt, native input and displayed item. Combined queued sends, old handles and altered input are distinct causes. An extra prefix such as `00` is not automatically stripped. A verified one-message display correction can preserve the original text; do not widen matching or rewrite provider history merely to paint a bubble orange.

For Windows commands with titles containing `>`, use the resolved native Orca executable rather than passing the title through a `.cmd` wrapper that may interpret shell redirection. Resolve the executable for the current Orca environment; do not hardcode an installation path or reuse another runtime's handle. If a background feedback server dies when the tool shell exits, verify that shutdown before retrying, then use the project's supported persistent launcher. Launcher acceptance is not server health.
