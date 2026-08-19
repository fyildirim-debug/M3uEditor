# Changelog

All notable changes to this project are documented here. Dates are ISO-8601.
Versions follow the four-part scheme recorded in `.fy/version.json`.

## [Unreleased]

### Removed

- **The `proxy` stream mode is gone, and with it every path that made this
  server a stream address.** In that mode `get.php` published a local
  `/live|/movie|/series` URL and each channel change arrived here first to be
  answered with a `302` to the provider — latency and a single point of failure
  on the playback path of an application that is a catalogue editor. There is now
  one behaviour and no switch: `get.php` hands out the provider's own URLs and
  `player_api.php` always fills `direct_source` with them. Removed: the three
  playback routes and their handlers, `getPlaybackTarget`, `setStreamMode`,
  `PUT /api/playlists/:id/xtream-output/stream-mode`, the mode selector in the
  Xtream output dialog, the `playlists.output_stream_mode` column, and the
  `/live|/movie|/series` entries in the nginx and Vite proxies. Tests now assert
  the opposite of what they used to: passing the old `output_stream_mode: 'proxy'`
  value produces provider addresses anyway, so the behaviour cannot leak back.
  **Note:** a player that ignores `direct_source` and builds stream URLs from the
  server address will no longer play; clients that honour `direct_source`
  (TiviMate, IPTV Smarters and the common mobile players) are unaffected.

### Added

- **The assistant can search the web, and nothing needs configuring.** The stack
  now ships SearXNG as an internal service — no domain, not attached to Traefik,
  reachable only at `http://searxng:8080` from inside the stack — and the API
  gets `SEARXNG_URL` by default from compose. Whichever model the user points the
  assistant at, `web_search` and `open_web_page` are already in the catalogue:
  there is no API key to obtain, no account, no setting. SearXNG's JSON output is
  off by default, so `searxng/settings.yml` enables it explicitly; the secret
  stays out of the repository and is injected as `SEARXNG_SECRET`. The service
  resolves to a private address, which the SSRF guard would normally refuse, so
  `safeFetch` gained an `allowPrivateHost` option granted **only** to the
  server-configured search URL — `open_web_page` follows addresses that come from
  search results and therefore runs under the normal guard, unable to reach the
  internal network. With `SEARXNG_URL` empty the two tools are not registered at
  all, so the model is never offered a capability that would fail. A boot-time
  probe logs whether search is answering, so a broken setup shows up in the server
  log rather than in a user's first attempt.
- **Dead channels can be repaired from a working source instead of deleted.**
  Providers rotate stream addresses; the playlist breaks even though the channels
  are still correct, and the only previous options — delete the dead ones or
  re-import everything — both discard the editing work. `repair_dead_channels`
  looks each dead channel up by name in an Xtream catalogue and rewrites **only
  `stream_url`**, leaving the name, category, logo and EPG match alone. With no
  credentials given it uses the playlist's own stored Xtream source, so no
  password has to be pasted into the chat. Only channels the health scan marked
  dead are touched — never-tested channels are deliberately excluded, since
  rewriting a working address is a regression. Names are matched through a shared
  normaliser (`TRT 1 FHD` ≡ `TR: TRT1 HD` ≡ `trt-1`), and each candidate address
  is tested before it is written, because swapping a broken URL for another
  broken URL would make the list look repaired while hiding the fault. `dryRun`
  previews, and the tool is `[YIKICI]` so both the destructive switch and the
  approval flow apply. Combined with a scheduled task it runs unattended, and the
  run's pre-run backup makes it undoable.
- **Scheduled tasks now keep a run log and can be undone in one click.** A task
  bound to a playlist takes a backup before every run and writes an `ai_task_runs`
  row with the status, the assistant's summary, the tools it executed and the
  before/after channel and category counts. The assistant's task tab lists that
  history with an *Undo* button per run, which restores the pre-run backup.
  Undo is honest about its scope: it returns the playlist to the moment before
  the run, so manual changes made afterwards are lost too, and the confirmation
  says so. A run cannot be undone twice, a run whose backup has aged out reports
  itself as not undoable instead of failing on the button, and a task with no
  playlist is marked not undoable from the start — a missing backup disables undo
  rather than cancelling the run. Task backups live in their own retention bucket
  (last 10, counted separately from manual ones) so nightly runs cannot evict the
  user's own backups. `list_task_runs` and `undo_task_run` give the assistant the
  same access, and the system prompt now tells it to bind a new task to a playlist
  so the backup — and therefore undo — exists.
- **Searchable logo library.** The channel panel gained a *Find logo* button that
  opens a grid over [tv-logo/tv-logos](https://github.com/tv-logo/tv-logos) —
  10.700+ logos in 48 countries plus 16 other groups. The box is pre-filled with
  the channel's name, the grid filters on every keystroke, and a country selector
  sits beside it with names rendered in the interface language (`Intl.DisplayNames`
  over ISO codes the API returns, so no country-name translation tables). Picking
  a logo writes it to the channel. The file index comes from GitHub's tree
  endpoint once a day and is cached in memory — searches never call out, and a
  failed refresh keeps serving the previous index. Images come from jsDelivr
  rather than raw.githubusercontent because the grid loads hundreds of thumbnails
  at once. Matching tolerates real channel naming: quality/country tags are
  stripped (`TRT 1 FHD` → `trt-1-tr.png`), Turkish characters are folded, and
  exact names outrank prefixes, which outrank partial word matches. Four assistant
  tools expose the same thing, including `apply_library_logos`, which fills in
  logo-less channels in bulk and reports what it was not confident about instead
  of guessing.
- **The assistant accepts file attachments.** The composer now carries a
  paperclip: `.m3u`, `.m3u8`, `.txt`, `.xml`, `.xmltv`, `.json` and `.csv` files
  up to 20 MB (`AI_ATTACHMENT_MAX_BYTES`, 200 MB per account) are stored on disk
  under `AI_ATTACHMENT_DIR` with only metadata, a preview and a content summary
  in `ai_attachments`. The format is read from the content, never the extension,
  and the file is written under a generated id rather than the supplied name, so
  a crafted filename cannot leave the user's own directory. The model does not
  receive the file: it gets the id and the summary, then works through
  `describe_attachment`, `read_attachment` (line windows with a continuation
  cursor), `search_attachment` (grep by line) or `import_attachment`, which hands
  an attached M3U to the normal import path. A 20 MB playlist is therefore usable
  without filling the context window. XMLTV attachments can be read and searched
  but not imported — EPG ingestion streams from a URL.
- **Downloadable output.** `save_output_file` and `export_playlist_to_file` write
  the assistant's reports, converted lists and filtered M3Us to real files that
  appear as download cards in the chat, served by
  `GET /api/ai/attachments/:id/download` behind the owner's session.
- **Live streaming of answers and tool steps.** `POST /api/ai/chat/stream`
  emits Server-Sent Events — `delta`, `tool`, `tool-result`, `attachment`,
  `approval`, `done`, `error` — so a long tool chain is visible while it runs
  instead of after it. Gateways that reject `stream: true` or answer with plain
  JSON are detected on the first response and the turn silently completes over
  the non-streaming path; the browser falls back the same way, which also keeps
  token refresh on the axios client that already handles it.
- **Approval gate for destructive work.** With the new *require approval*
  setting, a `[YIKICI]` call stops before it runs and returns a confirmation card
  carrying the tool name and an impact estimate. The rest of that turn's calls
  are held in `ai_pending_actions.queued_calls`, because a provider rejects a
  turn where some `tool_call`s have no result — approving runs exactly the stored
  call and continues, declining closes the whole queue with a "not approved"
  result the model can react to.
- **Scheduled assistant tasks.** `ai_tasks` holds recurring jobs ("test dead
  channels every night") that `SchedulerService` runs on the server with no
  browser open, minimum interval 15 minutes. Each run opens a fresh conversation
  so context does not accumulate, and a run is claimed by moving `last_run_at`
  forward before it starts, so a task that takes minutes is not restarted by the
  next tick. Destructive permission is per task and **off by default**; a task
  cannot ask for approval, so an unattended run that hits one stops and records
  why. Tasks are managed from a new panel tab and through five tools; a task
  cannot create or trigger another task, which rules out runaway loops.
- 13 new tools: the catalogue is now **175**.

### Fixed

- **Xtream output sent players to this server for films and series.** `get.php`
  and the stream lists already handed out the provider's own addresses, but
  `get_vod_info` returned `direct_source: ''` and the synthetic episode in
  `get_series_info` had no `direct_source` at all. An empty field leaves the
  player one option: build `{this server}/movie|/series/<user>/<pass>/<id>.<ext>`
  from `server_info` — a path that no longer exists here, so playback died on a
  404. Both responses now carry the provider address, like the live and VOD
  lists do, and the episode also gained the `season`, `added` and `custom_sid`
  fields players expect. Every response that names a stream address now names the
  provider's, never this server's. A regression guard walks every player-facing
  response and fails if this server's address turns up anywhere except the two
  places the protocol requires it: `server_info.url` (the catalogue endpoint the
  player was pointed at) and the artwork fields, which serve uploaded logos and
  are not playback addresses. (A player that ignores `direct_source` entirely
  still builds its own URL from `server_info`; for those, `get.php` remains the
  direct route — its lines are the provider URLs verbatim.)
- **An uploaded logo did not appear, and the same logo slot stayed empty
  afterwards.** Three separate causes, all fixed. (1) The upload URL was derived
  from the channel id alone, so re-uploading produced the byte-identical address
  `/logos/<id>.png` — and both nginx and express serve that path with
  `Cache-Control: immutable, max-age=30d`, so the browser never asked for the new
  file. Uploads now carry a version stamp (`?v=<timestamp>`), which busts the
  cache while keeping the long cache lifetime; `cleanup-logos` strips the stamp
  before deciding what is orphaned. (2) A logo that failed to load ran
  `$event.target.style.display = 'none'`, writing straight to the DOM. Vue reuses
  that same `<img>` element for the next address, so one dead provider URL hid the
  preview for every channel selected afterwards — including a logo just uploaded.
  Broken addresses are now tracked in reactive state keyed by URL, so a new
  address renders again and a broken one falls back to the placeholder (in the
  edit panel, to the upload button). (3) The endpoint rejected the upload when the
  browser-reported MIME type disagreed with the file's content signature — which
  is what happens with a PNG named `.jpg`. The content signature alone now decides
  the stored type; that is the check that was doing the security work anyway. The
  channel row in the table is also refreshed after an upload, and a `FileReader`
  failure no longer leaves the upload spinner running with no message.
- **Adding a channel that already exists answered "an unexpected error
  occurred".** A playlist may hold a stream address only once (the unique
  constraint is what the import upsert relies on), but `POST
  /api/playlists/:id/channels` let the raw constraint violation reach the generic
  handler as a `500`. The endpoint now checks first and answers `409
  DUPLICATE_CHANNEL` naming the channel already holding that address; a violation
  raised by a concurrent insert is translated to the same answer instead of
  leaking a database error.
- **Refreshing the page wiped the assistant conversation.** Chats were being
  stored server-side all along (`ai_conversations` / `ai_messages`) but the panel
  never asked for them, so every reload started from an empty box. The panel now
  remembers which conversation is open — per user, in `localStorage` — and
  restores it on load, along with the files exchanged in it and any approval that
  was still waiting when the page went away. A new history tab lists past
  conversations so an older one can be reopened or deleted, and *New chat* clears
  the remembered id. Downloadable output is recorded on the assistant message that
  produced it, so the download cards come back with the conversation instead of
  being matched by searching truncated tool output for an id.
- **Refreshing the page logged you out.** The SPA refreshes the session on every
  page load, but `/api/auth/refresh` was capped at 10 requests per 15 minutes
  *and* also passed through the general auth limiter (20), so the fifth reload of
  a working session answered `429` — and the client treated any failed refresh as
  proof of an invalid session and cleared it. Two changes: the refresh ceiling now
  counts failed attempts only (60 per 15 minutes, successes skipped, and `/refresh`
  no longer consumes the login/password budget), and the client clears the session
  only on `401`/`403`. A network blip, a timeout or a rate limit now leaves a valid
  session alone. Measured before the fix: logged out on reload 5 of 5; after: 20 of
  20 reloads kept the session.
- **You could not tell the assistant was answering.** With streaming, the reply
  arrives token by token, but the typing indicator was tied to a condition that
  became false the moment a turn started, so the first seconds of every turn — the
  wait before the first token — showed an empty panel. Assistant messages now carry
  an "Assistant · writing…" line, show the typing dots until the first character
  arrives, and a caret while text is streaming in.

### Changed

- **The 8.000-character message limit is gone.** Pasting a playlist into the box
  used to fail with a validation error. Text beyond `AI_INLINE_MESSAGE_CHARS`
  (12.000) is now stored as an attachment automatically and the model receives a
  preview plus the id, so long input behaves exactly like an attached file. The
  remaining ceiling is `AI_MAX_MESSAGE_CHARS` (1.000.000), configurable.
- Deleting a conversation now removes its attachment files from disk as well as
  its rows.
- An attachment whose content is only whitespace is rejected by the store, not
  just by the upload endpoint.

### Changed

- **Xtream output hands out the provider's own address.** (The `proxy` mode
  mentioned below was removed before release — see *Removed* above.) Channel
  URLs used to point at this server and every playback request was answered with
  a 302 to the provider, so the editor sat in the playback path of every channel
  change: extra latency, an extra point of failure and needless load. The new
  `direct` mode (default) publishes the provider address in `get.php` and fills
  `direct_source` in `player_api.php`, so the player pulls the stream straight
  from the source. The previous behaviour is still available as `proxy` mode,
  which keeps the provider credentials out of the playlist at the cost of routing
  every channel change through this server. The mode is per playlist
  (`playlists.output_stream_mode`), switchable from the Xtream output dialog and
  over `PUT /api/playlists/:id/xtream-output/stream-mode`.
- **Concurrent player requests are no longer mistaken for brute force.**
  `xtreamFailureLimiter` uses `skipSuccessfulRequests`, which increments the
  counter first and rolls it back when the request finishes. Players open dozens
  of requests at once while loading a list, so the counter briefly grew by the
  number of in-flight requests and the 15-request ceiling rejected legitimate
  clients — measured: 15 of 30 concurrent requests returned `429`, 45 of 60. The
  ceiling is now `XTREAM_FAILURE_RATE_LIMIT` (default 200), which absorbs the
  burst; with a 96-bit random username this is still meaningless for brute force.

- **AI assistant: relevance-ranked tool selection.** The catalogue holds 159
  domain tools but a provider request can only carry ~117 of them. They used to
  be sent in a fixed module order, so every tool in the last three modules
  (`imports`, `exports`, `account` — 42 in total) was never offered directly;
  the model could only reach them by spending an extra turn on
  `search_capabilities`. Tools are now scored against the user's message and the
  tools already run this conversation, so `share_playlist`, `enable_xtream_output`
  and `create_backup` show up when they are actually asked for. Scoring is
  stem-based, so Turkish suffixes ("yedeklerimi" → "yedek") match. Without hints
  the order is unchanged, so the behaviour stays deterministic.
- **AI assistant: the conversation starts with real state.** The system prompt
  now carries the user's playlists with channel counts, and for the active
  playlist the stream-type breakdown, categories (with hidden flags) and EPG
  source count. This removes the two or three discovery turns every conversation
  used to begin with. A failure while building the summary degrades to the old
  behaviour instead of breaking the chat.
- **AI assistant: independent reads run in parallel.** Consecutive read-only tool
  calls in one turn (`list_*`, `get_*`, `search_*`, `find_*`, `describe_*`,
  `count_*`, `preview_*`) are executed concurrently, up to six at a time; a
  writing or destructive call closes the batch and runs alone. Recorded order
  always matches the model's call order. `parallel_tool_calls` is now sent to the
  provider.
- **AI assistant: arguments are validated against the tool schema.** Missing
  required fields, wrong types and out-of-enum values are rejected before the
  tool runs and reported back with the schema attached, so the model corrects
  itself instead of burning a turn on an ad-hoc error.
- **AI assistant: the destructive permission is enforced centrally.** `execute`
  now applies it for every tool flagged destructive; previously each of the 27
  call sites had to remember `assertDestructive` on its own.
- **AI assistant: prompt-injection rule.** The system prompt states explicitly
  that text inside tool output (channel names, EPG titles, file names) is
  third-party data and never an instruction.
- **Xtream output is usable by real IPTV players again.** Players request one
  `get_short_epg` per channel while loading a playlist, so a single launch of a
  5.848-channel list produces roughly 6.000 requests. Two limits collided: the
  dedicated player limiter allowed 300 per 15 minutes, and `generalLimiter`
  (200 per **minute**) also covered the Xtream paths, so the narrower one always
  won and clients got `HTTP 429` during login. Xtream paths are now exempt from
  the general limiter and the player limit is configurable through
  `XTREAM_PLAYER_RATE_LIMIT` (default 20.000 per 15 minutes). Brute-force
  protection is unchanged: 15 failed authentications per 15 minutes.
- **The Vite dev server proxies the Xtream paths.** `player_api.php`,
  `xmltv.php`, `get.php`, `/live`, `/movie` and `/series` returned the SPA's
  `index.html` in development, so the Xtream output could not be exercised
  outside production. Production nginx already proxied them; the dev server now
  matches.
- `generalLimiter` returns the documented `{error:{code,message}}` body instead
  of plain text.

## [1.10.0.0] — 2026-08-02

AI release. The editor gained an assistant that operates the application through
tool calls instead of describing what the user should click, backed by whichever
OpenAI-compatible provider the user configures.

### Added

- **AI assistant (162 tools).** `POST /api/ai/chat` runs an OpenAI-style function
  calling loop server-side: the model requests a tool, the API executes it
  through the existing service layer under the authenticated user's identity,
  the result is fed back, and the loop repeats until the model answers or the
  per-user step limit (1–25, default 12) is reached. Tools cover playlists
  (list/create/rename/delete/stats), categories (bulk create, rename, hide,
  delete, delete-empty, sort by name/count/explicit order), channels (list,
  create, update, bulk update, move, find-and-replace rename with dry run, sort,
  duplicate detection, filtered deletion), EPG (sources, iptv-org library search,
  auto-match, tvg-id assignment, coverage), imports (M3U URL, Xtream with
  preview, sync, schedule, extra sources), exports (M3U preview, share links,
  Xtream output), filter rules, stream-health scans, backups, and view profiles.
  The catalogue is split into per-domain modules under `src/services/ai/tools/`.
- **Catalogue search for unlimited capabilities.** Providers cap functions per
  request (128 on OpenAI), so a turn carries the first 120 tools plus
  `search_capabilities`, `describe_capability` and `invoke_capability`. The model
  finds anything outside its current list by keyword and invokes it by name
  through the same permission checks, so the catalogue can grow past any
  provider limit without a capability becoming unreachable.
- **Markdown replies.** Assistant messages render bold, italic, strikethrough,
  inline code, fenced code blocks, bullet and numbered lists, headings, quotes,
  rules and http(s) links. The renderer escapes the whole message before applying
  formatting and refuses non-http schemes, so model output cannot inject HTML.
- **Assistant settings in Account.** The provider form moved into a shared
  component used by both the chat panel and a new section on the account page;
  saving in one place updates the other.
- **Playlist merging.** `merge_playlists` builds a new playlist from two or more
  existing ones in a single transaction: categories merge by name, channels are
  copied in source order with keyset-paginated reads (1000 rows at a time) and
  deduplicated by stream URL or by name.
- **Logos from the EPG guide.** `apply_epg_logos` copies `icon_url` from matched
  guide channels onto the playlist's channels — filling only empty logos by
  default, overwriting on request — and removes the local logo files the update
  orphans.
- **Bring-your-own provider settings.** `GET/PUT /api/ai/settings` stores base
  URL, model, temperature, step limit, destructive permission, and an optional
  extra system instruction per user; the API key is encrypted with AES-256-GCM
  and never returned. `POST /api/ai/models` proxies the provider's `GET /models`
  (accepting not-yet-saved credentials so the list can be fetched before
  saving), and `GET /api/ai/capabilities` publishes the tool catalogue.
- **Conversation history.** New `ai_settings`, `ai_conversations`, and
  `ai_messages` tables persist chats per user, including tool calls and results,
  so a conversation continues across turns. History is trimmed to the last 40
  messages without ever splitting a tool call from its result.
- **Assistant UI.** A launcher on every authenticated page opens a chat panel
  with provider settings, model dropdown, capability list, suggestion chips, and
  a per-message trace of the tools that ran (destructive ones highlighted).
  Editor and dashboard views refresh themselves when the assistant changes data.
  Turkish and English strings for the whole feature.

### Security

- The assistant's authority equals its own user's and never exceeds it. Tools
  call the same services as the HTTP API, so tenant ownership, field validation
  and business rules apply unchanged; no tool accepts a raw query or SQL. The
  acting identity comes from the session only — `userId`, `user_id`, `ownerId`,
  `is_admin` and similar keys are stripped from model-supplied arguments, and a
  call arriving without a session is refused. No admin capability is catalogued,
  so an administrator's assistant is still limited to that administrator's own
  data.
- Data-losing tools are marked `[YIKICI]` in the model-visible catalogue and
  refuse to run when the user's destructive-actions permission is off.
- Bulk selections are capped at 5000 channels per call and tool output is
  truncated to 12 000 characters before returning to the model.
- Provider requests use the SSRF-safe HTTP client (DNS pre-resolution, private
  address rejection, redirect revalidation, timeouts, response size caps), and
  `POST /api/ai/chat` and `/api/ai/models` are rate-limited per user.

### Changed

- `safeFetch` now forwards an optional request body, so the SSRF-safe client can
  issue the POST requests the provider API needs. GET behaviour is unchanged.

## [1.9.0.0] — 2026-08-01

Automation release. The editor can now keep playlists fresh on a schedule,
snapshost and restore user edits, check whether streams are alive, merge
multiple providers into one playlist, and filter what ever enters the library.

### Added

- **Scheduled auto-sync.** Playlists and EPG sources accept a refresh interval
  (off / 6h / 12h / 24h / 48h / weekly). A lightweight scheduler ticks every
  minute and syncs due playlists using the same category-selection semantics as
  manual sync (new provider categories are not auto-added), with optional
  pre-sync backup. `PUT /api/playlists/:id/sync-settings` and
  `PUT /api/epg/sources/:id/refresh-settings`.
- **Backup / restore.** One-click gzip snapshots (playlist + categories +
  channels including every user edit) stored on disk with metadata in the new
  `backups` table, automatic retention of the last 10 per playlist, download,
  restore onto a new or existing playlist, and automatic cleanup when the
  playlist is deleted. `GET/POST /api/playlists/:id/backups`,
  `GET /api/backups/:id/download`, `POST /api/backups/:id/restore`,
  `DELETE /api/backups/:id`.
- **Stream health scanning.** `POST /api/playlists/:id/health-scan` walks every
  channel with SSRF-safe HEAD/Range requests (10-way concurrency, 8 s timeout,
  100-row batched writes), records `last_checked_at`/`last_check_ok`/
  `last_check_status`, and reports live progress. The channel table shows
  per-channel health dots; new `dead`/`unchecked` filters surface the results.
- **Regex filter rules.** Ordered include/exclude rules over channel name,
  category, or stream URL, validated with `safe-regex2` and applied before every
  sync/import upsert — excluded records never reach the database. Rules are
  manageable from the Update view with a live pattern tester.
  `GET/POST /api/playlists/:id/filter-rules`, `PUT/DELETE /api/filter-rules/:id`.
- **Multiple Xtream sources per playlist.** Additional provider accounts
  (`playlist_sources` table) sync into the same playlist; same-named categories
  merge naturally. `POST /api/playlists/:id/sync-all` reconciles every source in
  sequence and only removes stale channels when all sources of a type complete,
  so one failing provider cannot delete another's channels.
- **Advanced channel filters.** `?filter=missing_logo|missing_epg|
  duplicate_name|dead|unchecked` on the channel list, with a dropdown and a
  filtered-result counter in the editor.
- **EPG source library.** Built-in iptv-org catalogue: browse countries and
  guide sources, search, and add a source in one click (24 h in-memory cache).
  `GET /api/epg-library/countries`, `GET /api/epg-library/guides`.
- **Saved EPG match profiles.** Auto-match now accepts strip prefixes/suffixes
  and ignore words; profiles are saved per playlist and re-runnable with mapped
  counts and last-run tracking. `GET/POST /api/playlists/:id/epg-profiles`,
  `POST /api/epg-profiles/:id/run`.
- **View profiles.** Named hidden-category sets per playlist; apply a profile
  to re-hide categories instantly, and pick a profile when downloading M3U so
  the export excludes its hidden categories. `GET/POST /api/playlists/:id/views`.
- **Quick wins:** up/down move buttons for sorting on mobile, keyboard
  shortcuts (`/` search, `g`+letter view switching), editor view/stream type in
  the URL (deep link survives reload), styled ConfirmModal replacing every
  native `confirm()`, share-link revocation (`DELETE /api/playlists/:id/share`),
  Xtream credential editing on the playlist, session management
  (`GET/DELETE /api/auth/sessions`) in Account settings, theme switcher in the
  header, and real import progress via `GET /api/import/jobs/active` polling
  instead of a simulated bar.

### Fixed

- Filtered channels were previously indistinguishable in search results — the
  filtered count now renders next to the total.

## [1.8.0.0] — 2026-08-01

Sync experience release. The update flow now mirrors the import wizard —
category selection with previous choices remembered and provider-new categories
badged — and ends with a detailed report. Xtream output credentials are now
visible to their owner at all times. Large-playlist EPG no longer freezes the
browser.

### Added

- **Category-selective sync.** `POST /api/playlists/:id/sync` accepts an optional
  `categories` selection, and `GET /api/playlists/:id/sync/preview` returns
  provider categories with `selected` (kept from previous choices, matching the
  importer's `VOD |`/`Series |` prefixed storage) and `isNew` flags. Previously
  sync silently imported every provider category, including ones the user had
  deliberately excluded at import time. The editor's Update view shows the
  selection panel and a report listing added categories and newly added channel
  names. Per-type selection is optional; unselected types are left untouched.
- **Xtream output password is always visible to its owner.** The password is now
  also stored AES-256-GCM encrypted (migration `20240101000021_add_output_password_enc`)
  alongside the existing hash used for player authentication, so
  `GET /api/playlists/:id/xtream-output` returns it and embeds it in the player
  URLs. Regeneration still invalidates the old password immediately. The editor
  combines M3U download and Xtream credentials into a single "Kanal Listesini
  İndir" modal.
- **EPG guide pagination.** `GET /api/playlists/:id/epg/guide` accepts
  `page`/`limit` (default 100) and returns `total`; the editor loads channels
  incrementally with infinite scroll and a loaded-count indicator. Guide rows no
  longer include program descriptions (up to 50 KB each) — they are fetched
  lazily via the new `GET /api/epg/programs/:id` when a program is opened. Grid
  hour lines moved from 24 DOM nodes per channel to a single CSS background,
  and off-screen rows skip rendering via `content-visibility`.

### Fixed

- **Child component DOM updates were suppressed when a toast fired in the same
  flush** (state changed, UI stayed stale — e.g. the playlist edit modal not
  closing after Save). `showToast` is now deferred to `nextTick` in `App.vue`.
- **Deleting a large playlist took ~13 s with no feedback** because logo cleanup
  issued a blind `unlink` for every channel × extension (222k syscalls at 55k
  channels). Cleanup now scans the upload directory once and only unlinks files
  that exist (~0.06 s), and the delete button shows a spinner and guards against
  double clicks.
- **EPG controls leaked into VOD/Series editing** (EPG id input, broadcast
  section, name autocomplete) — now limited to live TV.
- The Update view had no page scroll; category lists and action buttons below
  the fold were unreachable.
- The Xtream import wizard could trap the user with no way out: it now has a
  Cancel button with `AbortController`, a 150 s request timeout, and no longer
  closes on backdrop click (matching its multi-step, form-heavy nature).

### Changed

- `dev.sh` now includes `docker-compose.dev-ports.yml` when present so the
  development database port is published to loopback (the production compose
  file intentionally exposes none).

## [1.7.0.0] — 2026-07-28

Hardening release. The focus is data integrity, authentication strength, and
behaviour at provider scale rather than new surface area. Findings referenced as
`SPR-*` come from the stability/performance audit and `SEC-*` from the security
audit.

### Added

- **XMLTV output.** The application already downloaded, parsed, and matched EPG
  data, but exposed it to no consumer, so the delivery chain stopped at M3U.
  `GET /api/playlists/:id/xmltv` (authenticated) and `GET /api/shared/:token/xmltv`
  (reusing the existing share token, expiry, and password rules) now stream a
  guide, and shared M3U output carries an absolute `url-tvg` so players find it
  automatically. Channel ids are identical in both formats — otherwise matching
  breaks silently on the consumer side. `GET /api/playlists/:id/epg-coverage`
  reports how much of a playlist actually has guide data.
- **Features that existed only in the API are now in the editor:** adding a
  channel by hand, testing whether a stream is reachable, regex bulk rename,
  bulk field updates, and share links with an expiry and password. Bulk rename
  requires a preview first — `POST /api/channels/bulk-rename/preview` returns the
  first 20 before/after rows and writes nothing.
- `npm run make-admin -- <email>` grants (or, with `--revoke`, removes) admin
  rights. Without it the admin panel was unreachable after a fresh install,
  because `is_admin` defaults to false and nothing could set it.
- `node scripts/cleanup-logos.js` reports orphaned logo files (`--delete` removes
  them).

### Fixed — data loss

- **A transient Xtream failure no longer deletes channels (SPR-001).** VOD and
  series were treated as optional content types, and their errors were flattened
  into empty arrays. When live succeeded and VOD failed, the combined result was
  non-empty, so reconciliation classified every existing VOD row as stale and
  deleted it — together with any manual edits. `getAllChannels` now reports an
  explicit completion status per content type, only completed types are
  reconciled, and a partial sync no longer advances `last_synced_at`.
- **A reconciliation that would remove every row of a content type is refused.**
  A provider outage that returns `200` with an empty list is indistinguishable
  from a genuinely emptied catalogue, so the wholesale removal is skipped and
  reported. Partial removals still apply normally.
- **Xtream requests are no longer retried when retrying cannot help** — permanent
  `4xx` responses and invalid addresses fail immediately; `429` is still retried.

### Fixed — security

- **Access tokens are strictly validated (SEC-06).** The legacy fallback that
  accepted tokens without issuer, audience, or session id has been removed. Every
  request now revalidates the session against the database, so logout and
  password changes take effect immediately.
- **Refresh token reuse is detected (SEC-05).** Sessions carry a family id and a
  replacement pointer. Replaying an already-rotated token revokes the whole
  family, so a stolen token cannot outlive its detection.
- **Production refuses to start on weak secrets (SEC-04).** The documented
  `.env.example` placeholders were long enough to pass the old length check.
  Placeholder, low-entropy, short, and identical `JWT_SECRET` /
  `CREDENTIAL_ENCRYPTION_KEY` values are now rejected with actionable messages.
- **Dedicated rate limits (SEC-09)** for `/api/auth/refresh` (previously exempt)
  and for password-protected share downloads, which run a bcrypt comparison on
  every failed attempt. The share limiter is keyed per token hash plus client IP.
- **Account existence is no longer measurable through response timing (SEC-10).**
- **Writable channel fields are bounded and typed (SEC-01).** Columns are `text`,
  so a single request could previously write a multi-megabyte value to up to
  1,000 rows. Length, type, and control-character checks are enforced centrally,
  which also prevents newline injection into exported M3U output.
- **Remote fetches carry one absolute budget (SEC-02).** Each recursive redirect
  previously started a fresh timeout *and* a fresh byte allowance, and Xtream
  retried on top of that — one call could consume roughly five redirects × 120 s
  × three attempts while downloading a full size limit at every hop. A deadline
  and a shared byte counter now travel through DNS resolution, the whole redirect
  chain, retries, and the decompressed body.
- **Imports are bounded (SEC-02).** One job per user (`409`), a per-playlist lock,
  a global ceiling (`503`), a TTL, and cancellation when the client disconnects
  (`499`) — previously a proxy timeout cut the client off while the backend kept
  working.
- **Uploaded logos are deleted with their owner (SEC-11).** Files survived channel,
  playlist, and account deletion and stayed publicly readable at a guessable URL,
  so data a user believed erased remained available.
- Malformed request bodies and oversized payloads return `400`/`413` instead of
  `500` (SPR-023); logging out with only an access token now really revokes the
  session (SPR-036).

### Fixed — correctness

- **Channel and category ordering uses relative positions.** Drag-and-drop sent
  an index within one category (truncated to 500 rows) while the backend applied
  it as a playlist-global position, so moving a channel inside a category could
  reorder unrelated categories. The API now takes `{ afterChannelId }` or
  `{ beforeChannelId }` (and the category equivalents), which stays correct under
  pagination, filtering, and truncation. Failed drags roll the list back instead
  of silently leaving the UI out of sync, and a truncated sort view says so.
- Excluding a category from an export no longer also drops uncategorized
  channels (SPR-030).
- The stream reachability check no longer treats a `HEAD` response's
  `Content-Length` as an oversized body, which made every check fail (SPR-026).
- Bulk actions no longer include channels hidden by a page, content type, or
  search change, and a late channel response can no longer overwrite the current
  view (SPR-009, SPR-017).
- Changing an account e-mail updates the header immediately (SPR-033).

### Changed — performance

- **Sort order maintenance is set-based.** Reordering or deleting one channel
  issued one `UPDATE` per remaining row. At 20,000 channels, compaction went from
  2,805 ms to 353 ms over a local socket; against a remote database the gain is
  larger still, because 20,000 round trips become one statement (SPR-008).
- **The dashboard playlist list no longer aggregates every user's channels.** The
  grouped subquery scanned the whole `channels` table on each request; a lateral
  per-playlist count made a small account's query 6.3 ms → 0.1 ms while a 60,000
  channel neighbour existed, with identical results (SPR-015).
- **A truncated XMLTV response no longer replaces a working guide (SPR-024).** Only
  the opening `<tv` tag was required, so a proxy or provider returning an
  application-level truncated `200` had its partial prefix accepted and written
  over the existing guide. Document completeness is now validated, and a guide
  that would become empty or lose more than half its rows is refused unless the
  caller passes `force`.
- **EPG ingestion streams instead of buffering.** Peak RSS on a 150,000-programme,
  39 MB guide dropped from 309,828 KiB to 121,084 KiB (−60.9%), at a 14.5% time
  cost. Automatic channel matching went from 3,002 SQL statements to one, with
  identical results.

### Changed — operability

- The README now states plainly that the Compose stack terminates no TLS and
  documents the required reverse-proxy setup (SEC-03), and no longer implies that
  encrypting the stored Xtream password protects credentials that the protocol
  also embeds in every stream URL (SEC-07).
- Password reset requests are logged at error level when SMTP is unconfigured or
  delivery fails. The user-facing response stays generic to avoid disclosing
  account existence, so this log is the only signal an operator gets (SPR-027).
- Application start no longer inherits the 330 s import timeout, which could
  leave the page blank for minutes when the API was unreachable (SPR-021).
