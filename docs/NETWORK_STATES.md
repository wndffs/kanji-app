# Network States

This bounded Task123 API/input slice is separate from `OFFLINE_SHELL.md`, whose
production-only worker caches two public files for failed full-page navigation.
It never caches API responses or replays writes. Neither feature makes lessons
or reviews available offline or provides background reminder support.

The shell reports browser offline/online hints in Russian. An online event does
not prove API reachability: the reconnecting notice explicitly leaves server
availability unconfirmed. There are no probes, automatic retries or queued writes.
A normal API request that receives an HTTP-success response and parses its JSON
clears the notice. Failed HTTP responses, malformed JSON and aborted/network
failures do not falsely confirm recovery. The event contains no request or user
data and is not stored; it does not confirm any different in-flight write.

API client requests use `cache: "no-store"`, including authenticated reads and
writes. Fetch network TypeErrors produce actionable Russian feedback and leave
the request outcome unconfirmed. Abort and HTTP errors retain their contracts,
including status 401. A lost response can mean the server committed a write;
check current server state before manually resubmitting.

Existing review form state retains the typed answer in memory after rejection;
only server confirmation allows feedback/progression. No draft, answer, token or
queue persistence is added. Reloading or leaving the page can lose unsent input.
Existing authentication storage is unchanged. No external data, assets, licences
or dependencies are introduced.

Focused client tests cover no-store, rejected fetches, aborts and 401 responses.
The review browser regression uses local mocked API fixtures, checks browser
offline/online transitions, retained input, no false completion and no automatic
resubmission. It does not verify real network recovery, device installation,
offline navigation, background delivery or the full Task123 acceptance matrix.
