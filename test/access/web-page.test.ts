import { request as httpRequest } from "node:http";
import { expect, test } from "vitest";

import { recordPagePress } from "../../src/access/cli.js";
import type {} from "../../src/access/inbox.js";
import { AnswerPort, type ServedPorts } from "../../src/access/web-app.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import {
  asText,
  bytesOf,
  digestOf,
  fresh,
  keysCode,
  mint,
  openGate,
  operatorPage,
  type Pressed,
  portsOver,
  post,
  reserve,
  rows,
  serving,
  tokenIn,
} from "./page-world.js";

/** One request carrying a `Host` of our choosing, which `fetch` will not send. */
function withHost(base: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/`, { headers: { host } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ status: response.statusCode ?? 0, body });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

test("the page draws the request it selected, and says what a redraw does", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));

  // **What the page shows is a request's thread** (D-0083 rule 2), so the
  // person's own words are on it. This used to also assert what the reading
  // fold held -- `rondo inbox`, `between` and `explain`, drawn whole -- and
  // that fold is gone with D-0083: rule 4 puts the inbox in the empty centre,
  // rule 5 the material on the right face, and `between` is read from the
  // terminal.
  expect(html).toContain("do the thing");
  // The page says out loud what a redraw does, because a screen that moves a
  // last-look mark by being left open is worse than one that says it does not.
  expect(html).toContain("a redraw writes nothing");
  expect(html).toContain('http-equiv="refresh"');
});

test("looking at the page writes nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");

  // Three draws of each view, which is what a page that refreshes itself does
  // while nobody is at the desk -- and the redraw of an answering view left
  // open on a desk is the one that matters most, because that view composes the
  // very framing a press records. Each of them would have been a presentation
  // counted and a last-look mark moved if this surface had the command line's
  // ports (D-0041).
  for (let draw = 0; draw < 3; draw += 1) {
    await operatorPage(portsOver(world, "ada", []), "t");
    await operatorPage(portsOver(world, "ada", []), "t", { kind: "requests" });
    await operatorPage(portsOver(world, "ada", []), "t", {
      kind: "thread",
      messageId: "req-i-0001",
      to: null,
    });
  }

  expect(rows(world.connection, "proposal")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
  expect(rows(world.connection, "operator_view")).toBe(0);
  expect(rows(world.connection, "human_decision")).toBe(0);
});

test("a press records the framing it rests on, and one that cannot be recorded answers nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = {
    store: world.store,
    record: world.record,
    now: () => 6_000,
    present: () => undefined,
  };

  expect(await recordPagePress(ports, "i-0001")).toEqual({
    ok: true,
    note: "",
  });

  // The two rows the page drew and never held: the framing itself, and the
  // count of it having reached somebody (D-0042 rule 1). Written on the press
  // and on nothing else -- "looking at the page writes nothing" above is the
  // other half of the same claim, over the same tables.
  expect(rows(world.connection, "proposal")).toBe(1);
  expect(rows(world.connection, "operator_attention")).toBe(1);
  // The mark stays where `rondo inbox` left it: a press is proof one row was
  // read and not proof an inbox was (rule 2).
  expect(rows(world.connection, "operator_view")).toBe(0);

  // Rule 3: a framing that will not record is a sentence the person reads, and
  // the caller stops there rather than walking the gate.
  const missing = await recordPagePress(ports, "i-0404");
  expect(missing.ok).toBe(false);
  expect(missing.note).toContain("nothing was answered");
  expect(rows(world.connection, "proposal")).toBe(1);

  // A framing recorded and not counted complains and lets the press through:
  // the command line exits 1 on the same outcome, and a browser cannot read an
  // exit status, so the line goes to the terminal `rondo web` runs in.
  const said: string[] = [];
  const uncounted = await recordPagePress(
    {
      ...ports,
      now: () => 7_000,
      record: {
        ...world.record,
        recordAttention: async () =>
          await Promise.resolve({
            kind: "refused" as const,
            reason: "the table is locked",
          }),
      },
    },
    "i-0001",
    (line) => said.push(line),
  );
  expect(uncounted.ok).toBe(true);
  expect(said.join("\n")).toContain("recorded and not counted as presented");
  expect(rows(world.connection, "proposal")).toBe(2);
  expect(rows(world.connection, "operator_attention")).toBe(1);
});

test("an empty store renders a page rather than an error", async () => {
  const html = await operatorPage(portsOver(fresh(), null));

  // **Empty is the ordinary state, and its centre asks** (D-0083 rule 4). It
  // used to be a sentence counting three zeroes; a question is what the
  // decision put there instead.
  expect(html).toContain("What would you like to ask for?");
  // No approver, and the page says so **where it is visible**, rather than
  // drawing somebody else's inbox, showing an empty one as though it were
  // theirs, or explaining a missing button on a screen nobody arrives at.
  expect(html).toContain("RONDO_APPROVER is not set");
});

test("a request keeps its paragraphs and its markup is text (rondo#90)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "first line\n\nsecond <b>paragraph</b>");

  // The words are the request's own, so they are read in its thread: nothing
  // is waiting here, and rule 3 selects nothing (rule 4's empty centre).
  const html = await operatorPage(portsOver(world), null, {
    kind: "thread",
    messageId: "req-i-0001",
    to: null,
  });

  // The newline survives as a newline: the terminal escapes it to a `\u` form
  // (D-0004) because a cp932 console may not encode it, and a browser has no
  // such problem. `white-space: pre-wrap` is what renders it.
  expect(html).toContain("first line\n\nsecond");
  expect(html).not.toContain("\\u000a");
  // ...and the paragraph that carries it is not cut to one line. The words are
  // in the thread now (D-0083 rule 5) rather than on a running row, so the
  // measure and the wrapping are `page/thread.css`'s rather than a class list
  // on the element.
  expect(html).toMatch(/<p lang="">first line/);
  expect(bytesOf("page/thread.css").toString("utf8")).toMatch(
    /\.msg p \{[^}]*white-space: pre-wrap/,
  );
  expect(html).toContain("&lt;b&gt;paragraph&lt;/b&gt;");
  expect(html).not.toContain("<b>paragraph</b>");
});

test("it serves the page on localhost, and only the one page", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const { base, stop, served } = await serving(portsOver(world));

  const page = await fetch(`${base}/`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  // **The attack neither the token nor the `Host` check reaches.** Another
  // page cannot read this one, so it cannot steal the token -- but it can
  // frame this one under a button of its own, and the click that follows
  // carries the genuine token from the loopback origin. The browser is what
  // refuses that, and only if it is told to.
  // Since D-0059 the policy also says nothing runs that this process did not
  // serve (R2's substitute), so the header is a list and the one directive this
  // test is about is asserted by name.
  const policy = page.headers.get("content-security-policy") ?? "";
  expect(policy.split(/;\s*/)).toContain("frame-ancestors 'none'");
  expect(policy.split(/;\s*/)).toContain("default-src 'self'");
  expect(policy.split(/;\s*/)).toContain("script-src 'self'");
  // **The referrer policy is part of the press, not decoration.** Under
  // `no-referrer` (the middleware's default) a browser sends the form's `POST`
  // with `Origin: null`, which the press refuses -- so a real person's click on
  // `approve` was refused while every hand-written request here passed.
  // Observed in headless Chromium against this page on 2026-09-14.
  expect(page.headers.get("referrer-policy")).toBe("same-origin");
  expect(await page.text()).toContain("do the thing");

  // **A request's thread is the same page at a second address**, and the
  // redraw it serves points back at that address -- so what an operator
  // opened is still what is drawn five seconds later. This was the reading
  // fold's property before D-0083 took the fold away; it is the same claim
  // about the same mechanism, made where the page still has two addresses.
  const withThread = await fetch(`${base}/?thread=req-i-0001`);
  expect(withThread.status).toBe(200);
  const threadHtml = await withThread.text();
  expect(threadHtml).toContain("do the thing");
  expect(threadHtml).toContain('content="5;url=/?thread=req-i-0001&amp;lang=en"');

  // One page and no router: a typo'd path says so rather than quietly showing
  // the only page there is.
  expect((await fetch(`${base}/inbox`)).status).toBe(404);
  // With no approver there is no write port, so the door is shut at the method
  // rather than at the token: there is nobody this page could answer as.
  expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(403);
  // And a method that is neither a read nor the one write is still refused.
  expect((await fetch(`${base}/`, { method: "DELETE" })).status).toBe(405);

  // **A page on an attacker's domain, rebound to 127.0.0.1, gets nothing.**
  // The socket cannot tell that request from the operator's own -- both arrive
  // on loopback -- and the `Host` header is what does.
  // `fetch` refuses to send a `Host` of its caller's choosing, which is exactly
  // the header under test -- so this one request is made with `node:http`.
  const rebound = await withHost(base, "evil.example");
  expect(rebound.status).toBe(421);
  expect(rebound.body).not.toContain("i-0001");

  stop.abort();
  expect(await served).toBe(0);
});

test("the button is drawn only where there is a gate and somebody to answer it", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const pressed: Pressed = [];
  const thread = { kind: "thread", messageId: "req-i-0001", to: null } as const;

  // Reserved and not yet at a gate: nothing is asking, so **no approve button**
  // is offered. The box to add to the request is always there (D-0083 rule 5),
  // so what this asks is that there is no press to answer a gate with.
  const quiet = await operatorPage(portsOver(world, "ada", pressed), "t", thread);
  expect(quiet).not.toContain('id="answering"');
  expect(quiet).not.toContain("gate-i-0001");

  await openGate(world, "i-0001");
  // **The box is in the thread** (D-0083 rule 3): the screen that shows the
  // request is the screen that carries the press, and there is no second
  // address in between.
  const offered = await operatorPage(portsOver(world, "ada", pressed), "t", thread);
  expect(offered).toContain('id="answering"');
  expect(offered).toContain('method="post"');
  expect(offered).toContain("gate-i-0001");
  // **What the press would approve over, beside the press** (D-0029 rule 2).
  // The screen that is easier to reach than the terminal must not also be the
  // screen that asks for less before it writes.
  expect(offered).toContain("work    rondo/i-0001");
  // And a thread whose lap is not at a gate gets neither: the conditions are
  // the same ones `rondo answer` refuses on.
  const other = await operatorPage(portsOver(world, "ada", pressed), "t", {
    kind: "thread",
    messageId: "req-i-0404",
    to: null,
  });
  expect(other).not.toContain('id="answering"');

  // No approver, no write port, no button -- even at the same open gate. The
  // page is not a second place rondo will act for an unnamed person. Asked of
  // the server since D-0059: the renderer no longer holds the writer (rule
  // 3a), so *whether there is one* is decided where it is held, and handed
  // down as a token or as nothing.
  const { base, stop, served } = await serving(portsOver(world, null));
  expect(await (await fetch(`${base}/?lang=en`)).text()).not.toContain("<form");
  expect(await (await fetch(`${base}/?thread=req-i-0001&lang=en`)).text()).not.toContain("<form");
  stop.abort();
  expect(await served).toBe(0);
});

test("a person's press answers the gate and an unattended redraw cannot", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));

  // Whatever the page draws while nobody is there is a GET, and a GET holds
  // only the reading ports. Three of them, then nothing was answered.
  for (let draw = 0; draw < 3; draw += 1) {
    await fetch(`${base}/`);
  }
  expect(pressed).toEqual([]);

  const token = tokenIn(await (await fetch(`${base}/?thread=req-i-0001`)).text());
  const answered = await post(base, {
    token,
    iteration: "i-0001",
    request: "req-i-0001",
    body: "revise",
  });

  // The body the form carried is ignored: the button's word is the module's
  // constant, so a hand-written post cannot widen what this surface may say.
  expect(pressed).toEqual([{ iterationId: "i-0001", body: "approve" }]);
  // A redirect and not a page, so a refresh re-reads rather than re-answers --
  // and it carries the tag the press was made under (D-0056 rule 11), so the
  // page the operator lands back on does not re-resolve its language. It lands
  // in the thread the press was made in (D-0083 rule 3), where the event line
  // for what it did is now the last thing on the time axis.
  expect(answered.status).toBe(303);
  expect(answered.location).toBe("/?thread=req-i-0001&lang=en");

  stop.abort();
  expect(await served).toBe(0);
});

test("a form from another page is refused, token first and origin too", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));
  const token = tokenIn(await (await fetch(`${base}/?thread=req-i-0001`)).text());

  // **The attack the `Host` check does not reach.** A form on evil.example
  // posting to http://127.0.0.1:7333/ sends exactly the `Host` the operator's
  // own browser sends, so the DNS-rebinding defence passes it through. What it
  // cannot do is read this page, so it cannot carry the token.
  expect((await post(base, { iteration: "i-0001" })).status).toBe(403);
  expect((await post(base, { token: "not-the-token", iteration: "i-0001" })).status).toBe(403);
  // Corroboration rather than the gate: an `Origin` naming somewhere else is
  // refused even when the token is right, which cannot happen and costs little.
  expect(
    (await post(base, { token, iteration: "i-0001" }, { origin: "https://evil.example" })).status,
  ).toBe(403);
  // A token with no iteration names nothing to answer.
  expect((await post(base, { token })).status).toBe(400);

  expect(pressed).toEqual([]);

  stop.abort();
  expect(await served).toBe(0);
});

test("a refusal from the write port is shown rather than redirected away", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports: ServedPorts = {
    ...portsOver(world),
    material: async () => await Promise.resolve(asText("work    rondo/i-0001")),
    answer: new AnswerPort(
      async () =>
        await Promise.resolve({
          ok: false,
          note: "continuo is not usable: no CLI",
        }),
    ),
  };
  const { base, stop, served } = await serving(ports);
  const token = tokenIn(await (await fetch(`${base}/?thread=req-i-0001`)).text());

  const refused = await post(base, { token, iteration: "i-0001" });
  // 303 back to a page still showing the same open gate would be the one answer
  // a person cannot act on: they pressed the button and nothing appears to have
  // happened. The reason is the response.
  expect(refused.status).toBe(409);
  expect(refused.body).toContain("continuo is not usable");

  stop.abort();
  expect(await served).toBe(0);
});

test("a lap at a gate carries its cost and its fence beside the button (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const settled = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    { lapCostUsd: 1.42, lapTurns: 18, permissionDenials: '["Bash(rm:*)"]' },
    3_000,
  );
  expect(settled.kind).toBe("transitioned");

  const answering = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-i-0001",
    to: null,
  });

  // **What a press records as shown, beside the press** (D-0042 rules 1 and
  // 4). `recordPagePress` stores `explainIteration`'s entire claim set and
  // counts it as presented, so every one of those claims has to have reached
  // the browser. rondo#145's complaint was that this belonged on a screen of
  // its own rather than on every waiting row of a summary; D-0083 rule 3
  // answered it the other way -- there is one screen, and the claims are in
  // the box on it, drawn for the one request being answered.
  expect(answering).toContain('method="post"');
  expect(answering).toContain("What pressing approve records as shown");
  expect(answering).toContain("snapshot /iteration/lapCostUsd = 1.42");
  expect(answering).toContain("snapshot /iteration/lapDurationMs = null");
  expect(answering).toContain("work    rondo/i-0001");
  // **And it holds still while they read it** (D-0054 rule 1). This view used
  // to point a meta refresh back at itself, which kept the address but still
  // threw the document away under the reader every five seconds -- rondo#160's
  // complaint, observed on lapja-001. It now updates by nothing at all, and
  // nothing is staler for it: D-0042 re-composes this framing at press time and
  // refuses a press naming a row that is not there.
  expect(answering).not.toContain('http-equiv="refresh"');

  // **And the framing is read for the one request being answered**, never for
  // every row: both cost a read per lap, on a surface that redraws every five
  // seconds. With nothing waiting, nothing is selected and nothing is read.
  const quiet = await operatorPage(portsOver(fresh(), "ada", []), "t");
  expect(quiet).not.toContain("What pressing approve records as shown");
  expect(quiet).not.toContain("work    rondo/i-0001");
});

test("the elements that quote material carry the lang the plan asked for (D-0053 rule 12)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "重みが足りない", "ja");
  await openGate(world, "i-0001");
  const html = await operatorPage(
    {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("なぜ止まったか")),
    },
    "t",
    { kind: "thread", messageId: "req-i-0001", to: null },
  );

  // **The element rule 12 names that this page still draws**: the block a
  // press records as shown. The other was the summary row's paragraph of the
  // lap's own request string, and D-0083 rule 2 replaced it -- the thread is
  // named by the person's own words, whose language rondo does not know
  // (D-0055 rule 8, below).
  expect(html).toMatch(/<pre class="material[^"]*" lang="ja">/);
  // **The chrome is `en` because this host asked for nothing**, which is what
  // D-0055 rule 7 leaves unchanged: the document names the language rondo
  // actually wrote it in, and with no ask that is still English.
  expect(html).toContain('<html lang="en">');
  // **Nothing is translated** (rule 11): the same bytes, with an attribute.
  expect(html).toContain("重みが足りない");
  expect(html).toContain("なぜ止まったか");
});

test('a lap nobody asked a language of says so with `lang=""` (D-0055 rule 8)', async () => {
  // **The empty string is HTML's own way of saying *the language here is
  // unknown***, and it is what rondo has to say once the document stops being
  // `en`. The absent attribute this carried before inherited the chrome, which
  // was harmless while the chrome was always English and would turn *rondo does
  // not know* into a guess on the way past under a `ja` host.
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = {
    ...portsOver(world, "ada", []),
    material: async () => await Promise.resolve(asText("why it stopped")),
  };
  const view = { kind: "thread", messageId: "req-i-0001", to: null } as const;
  const html = await operatorPage(ports, "t", view);

  // The words a person wrote, and the material the press is made over.
  expect(html).toMatch(/<p lang="">do the thing<\/p>/);
  expect(html).toMatch(/<pre class="material[^"]*" lang="">/);
  // It does not become the chrome's tag on a host that asked for one, which is
  // the whole of what the empty string is here to refuse: the two attributes
  // are true about different things and nothing reconciles them.
  const inJapanese = await operatorPage(ports, "t", view, chromeFor("ja"));
  expect(inJapanese).toContain('<html lang="ja">');
  expect(inJapanese).toMatch(/<p lang="">do the thing<\/p>/);
  expect(inJapanese).toMatch(/<pre class="material[^"]*" lang="">/);
});

/** Every `<script>` start tag in one document. */
const scriptTagsIn = (html: string): readonly string[] =>
  [...html.matchAll(/<script\b[^>]*>/g)].map((found) => found[0]);

/** What is left of a document when its scripts never run (D-0054 rule 7). */
const withoutScripts = (html: string): string =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

test("liveness is per view: two views poll and swap, and the answer view updates by nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = portsOver(world, "ada", []);

  const summary = await operatorPage(ports, "t", { kind: "summary" }, EN, mint);
  const opened = await operatorPage(ports, "t", { kind: "requests" }, EN, mint);

  for (const [html, href] of [
    [summary, "/?lang=en"],
    [opened, "/?requests=open&amp;lang=en"],
  ] as const) {
    // htmx, then rondo's key script, both deferred so neither runs before the
    // document, and both served by this process (D-0059 R1, R2): root-relative
    // paths and no scheme anywhere, because a CDN tag is the one distribution
    // D-0054 rule 5 refused and R1 did not reopen.
    expect(scriptTagsIn(html)).toEqual([
      '<script src="/htmx.min.js" defer="">',
      '<script src="/keys.js" defer="">',
      '<script src="/composer.js" defer="">',
    ]);
    expect(html).not.toContain("//cdn");
    expect(scriptTagsIn(html).filter((tag) => tag.includes("://"))).toEqual([]);
    // **The refresh is a `GET` of this view's own address**, and the one
    // element it swaps is the ledger (D-0054 rules 1 and 2, R3).
    // **What the poll swaps is the faces** (D-0083 rule 5). It wrapped the
    // status groups while the page was a ledger of laps; the name is kept
    // because `hx-get` and `hx-select` have to agree with each other.
    expect(html).toContain(
      `<div id="ledger" hx-get="${href}" hx-trigger="every 5s" hx-select="#ledger" hx-swap="outerHTML" hx-select-oob="#waiting-count">`,
    );
    // The boxes are inside the faces now, so each says it survives the swap
    // -- and nothing else on the page asks htmx for anything.
    const asked = [...html.matchAll(/hx-[a-z-]+=/g)].map((found) => found[0]);
    expect(asked.slice(0, 5)).toEqual([
      "hx-get=",
      "hx-trigger=",
      "hx-select=",
      "hx-swap=",
      "hx-select-oob=",
    ]);
    // **The only other thing on the page that asks htmx for anything is the
    // send box's own swap**, and only where the box is a reply: a new request
    // lands in its own thread, a different view, so it is a native submit.
    expect(
      asked
        .slice(5)
        .every((one) =>
          [
            "hx-post=",
            "hx-target=",
            "hx-select=",
            "hx-swap=",
            "hx-select-oob=",
            "hx-disabled-elt=",
          ].includes(one),
        ),
    ).toBe(true);
    // **R2's substitute is the library's configuration**, and it is on the
    // page rather than assumed from htmx's defaults.
    const config = JSON.parse(
      (/<meta name="htmx-config" content="([^"]*)"/.exec(html)?.[1] ?? "{}").replaceAll(
        "&quot;",
        '"',
      ),
    ) as Record<string, unknown>;
    expect(config).toEqual({
      selfRequestsOnly: true,
      allowEval: false,
      allowScriptTags: false,
      historyEnabled: false,
      includeIndicatorStyles: false,
      // A refused send lands under the draft rather than nowhere (#220 S1).
      responseHandling: [
        { code: "204", swap: false },
        { code: "[23]..", swap: true },
        {
          code: "[45]..",
          swap: true,
          error: true,
          target: "#composer-note",
          select: "#send-refused",
          swapOverride: "innerHTML",
        },
      ],
    });
    // **No meta refresh where a person may be writing** (#220 S1): both of
    // these carry a box, and with script off a reload would throw a
    // half-written draft away. The page says which of the two it is, in the
    // sentence at its foot.
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).toContain("Redraws every 5s, and a redraw writes nothing");
  }
  // **The faces are inside what the refresh swaps**, and the boxes inside
  // them say they survive it: counted by `<div>` depth from `#ledger`'s own
  // opening tag.
  const ledgerAt = summary.indexOf('<div id="ledger"');
  const depthAt = (marker: string): number => {
    const at = summary.indexOf(marker);
    expect(at, marker).toBeGreaterThan(ledgerAt);
    const between = summary.slice(ledgerAt, at);
    return (between.match(/<div[\s>]/g) ?? []).length - (between.match(/<\/div>/g) ?? []).length;
  };
  expect(depthAt('<div class="page-faces"')).toBeGreaterThan(0);
  expect(depthAt('<div id="answering"')).toBeGreaterThan(0);
  expect(depthAt('<form id="composer"')).toBeGreaterThan(0);

  // **A view a press is made from holds still** (D-0054 rule 1): the scope
  // screen and the publish screen have no poll, no refresh and no library
  // loaded to do either, so there is nothing to degrade to.
  const still = await operatorPage(ports, "t", {
    kind: "scope",
    messageId: "req-i-0001",
    rounds: null,
    decisionId: null,
    plan: null,
  });
  expect(scriptTagsIn(still)).toEqual([
    '<script src="/keys.js" defer="">',
    '<script src="/composer.js" defer="">',
  ]);
  expect(still).not.toMatch(/hx-[a-z]+=/);
  expect(still).not.toContain("htmx");
  expect(still).not.toContain('http-equiv="refresh"');
  expect(still).not.toContain("<noscript>");
  expect(still).toContain("This view does not update itself");
});

test("every view is whole with the script gone", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = portsOver(world, "ada", []);

  // The document a browser with scripting disabled draws, and the document a
  // browser whose scripts 404 is left holding: the same one, because nothing
  // on this page is produced by script (D-0054 rule 7).
  const summary = withoutScripts(await operatorPage(ports, "t"));
  const answering = summary;

  // What needs the operator, and the box to answer it in -- both on the one
  // page (D-0083 rule 3), whole without a line of script.
  expect(summary).toContain("do the thing");
  expect(summary).toContain("Waiting on your answer");
  expect(summary).toContain('id="answering"');

  // **And the press**: the form, the gate it answers, the one word it carries
  // and the material it is answered over. A button only script renders is the
  // first thing rule 7 names as a violation of it -- and the press is a native
  // form, never an `hx-post`, because only a person's navigation mints one
  // (D-0059 section 5).
  expect(answering).toContain('method="post"');
  expect(answering).toContain('<button type="submit"');
  expect(answering).not.toContain("hx-post");
  expect(answering).toContain("gate-i-0001");
  expect(answering).toContain("work    rondo/i-0001");
  expect(tokenIn(answering)).toBe("t");

  // **What only the script makes true is marked so, and hidden until it runs**
  // (D-0059 R3): the key hints and the live indicator. `page/app.css` hides
  // `.js-only` unless `page/keys.js` has put `js` on the root element.
  expect(summary).toMatch(/<span class="js-only [^"]*"><span[^>]*><\/span>live<\/span>/);
  expect(summary).not.toContain('<html lang="en" class="js"');
  expect(bytesOf("page/app.css").toString("utf8")).toContain("html:not(.js) .js-only");
});

test("an unattended poll writes nothing, however many times it goes round", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  // With an approver, so the write port exists and is simply never reached: a
  // page that wrote nothing because it had nothing to write with would not be
  // asserting anything (D-0041 rule 4).
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));

  // **What the refresh does, done over the socket it would use.** Five rounds
  // of each live view plus the answering one, which is what a page left open on
  // a desk for half a minute issues while nobody is there. Every one of them is
  // the request htmx's poll makes -- a `GET` of the address being read, with
  // htmx's own headers -- and every one reaches a renderer holding only the
  // read ports, and a port that mints no press from a `GET` (D-0059 R4).
  for (let poll = 0; poll < 5; poll += 1) {
    for (const address of ["/", "/?reading=open", "/?answer=i-0001"]) {
      const response = await fetch(`${base}${address}`, {
        headers: {
          "hx-request": "true",
          "hx-current-url": `${base}${address}`,
        },
      });
      expect(response.status).toBe(200);
    }
  }

  // The four tables a presentation, a look, a decision or a proposal would
  // land in (D-0042, D-0032 rules 9 and 10).
  expect(rows(world.connection, "proposal")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
  expect(rows(world.connection, "operator_view")).toBe(0);
  expect(rows(world.connection, "human_decision")).toBe(0);
  // And nothing was answered, which is the same claim at the other port.
  expect(pressed).toEqual([]);

  stop.abort();
  expect(await served).toBe(0);
});

test("it serves rondo's key script as the bytes the tree holds, and D-0054's two files no more", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world));

  // **The served bytes are the tree's bytes.** Not "a file was served": the
  // digest of what came down the socket, against the source the build copies
  // (the manifest's own check is `test/access/web-app.test.ts`).
  const keys = await fetch(`${base}/keys.js`);
  expect(keys.status).toBe(200);
  expect(keys.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(digestOf(Buffer.from(await keys.arrayBuffer()))).toBe(digestOf(bytesOf("page/keys.js")));

  // **R2 retired the vendored morph and its poller**, so their addresses are
  // the 404 any other path is -- not a stale copy left in reach.
  expect((await fetch(`${base}/idiomorph-0.8.0.min.js`)).status).toBe(404);
  expect((await fetch(`${base}/poll.js`)).status).toBe(404);
  expect((await fetch(`${base}/package.json`)).status).toBe(404);
  expect((await fetch(`${base}/../package.json`)).status).toBe(404);
  // And a script path is not a second door: the only writable address is `/`,
  // so a POST to one is the same 404 a POST to any other path is.
  expect((await fetch(`${base}/keys.js`, { method: "POST" })).status).toBe(404);

  stop.abort();
  expect(await served).toBe(0);
});

test("rondo's own script moves focus and follows the server's links, and asks for nothing", () => {
  const code = keysCode();

  // **Its three targets are elements the server rendered**: the rows, the
  // row's link, and the view's way back (D-0059 rule 5, R3).
  expect(code).toContain('"[data-row]"');
  expect(code).toContain('"a[data-open]"');
  expect(code).toContain('"a[data-back]"');
  // And the one mark it leaves, which is what un-hides the hints (rule 7).
  expect(code).toContain('document.documentElement.classList.add("js")');

  // **No request of its own.** Following a rendered link is a navigation `GET`
  // the server wrote the address of; everything else a script could ask for is
  // asserted absent, so D-0054 rule 6's audit is still one file's worth of
  // `not.toContain`.
  for (const forbidden of [
    "fetch",
    "POST",
    "method",
    "XMLHttpRequest",
    "EventSource",
    "WebSocket",
    "sendBeacon",
    "FormData",
    "submit",
    "localStorage",
    "sessionStorage",
    "eval",
    "innerHTML",
    "document.write",
    "location.href =",
    "htmx.",
  ]) {
    expect(code).not.toContain(forbidden);
  }
  // **The two htmx events it hears are the refresh about to be sent and about
  // to be swapped, and all it may do at either is decline**: cancel the
  // request while a person holds a text selection, and skip a swap that would
  // bring back the same ledger. Declining asks for nothing.
  expect([...code.matchAll(/htmx:[A-Za-z]+/g)].map((found) => found[0])).toEqual([
    "htmx:beforeRequest",
    "htmx:beforeSwap",
  ]);
});
