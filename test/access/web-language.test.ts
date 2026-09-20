import type { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { recordPagePress } from "../../src/access/cli.js";
import type {} from "../../src/access/inbox.js";
import type { ServedPorts } from "../../src/access/web-app.js";
import { type Chrome, chromeFor, EN } from "../../src/access/wording.js";
import {
  asText,
  fresh,
  get,
  openGate,
  operatorPage,
  type Pressed,
  portsOver,
  post,
  recorded,
  reserve,
  rows,
  serving,
  tokenIn,
} from "./page-world.js";

/**
 * D-0055: rondo's chrome is prose the operator reads, and its language comes
 * from the host's one operator.
 *
 * The four properties the entry asks the implementing change to show are below,
 * and the middle one is the one that would cost something if it broke: the
 * bytes a press records must not depend on the host's language, because a
 * ledger holding two wordings of one claim cannot answer *which version was
 * under the button* (rule 4, and D-0042's invariant with it).
 */

/** The same world twice, so two hosts can be pressed against separately. */
async function waitingWorld(): Promise<ReturnType<typeof fresh>> {
  const world = fresh();
  await reserve(world, "i-0001", "重みが足りない", "ja");
  await openGate(world, "i-0001");
  return world;
}

test("the bytes a press records do not depend on the host's language (D-0055 rule 4)", async () => {
  // **Pressed on both hosts after both have drawn the row**, because the press
  // is the presentation (D-0042): what is asserted is not that one function
  // ignores an argument, but that the whole path an operator walks -- render,
  // read, press -- writes the same ledger under `en` and under `ja`.
  const worlds = [
    { world: await waitingWorld(), wording: EN },
    { world: await waitingWorld(), wording: chromeFor("ja") },
  ];
  const drawn: string[] = [];
  for (const { world, wording } of worlds) {
    const ports = {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("why it stopped")),
    };
    drawn.push(await operatorPage(ports, "t", { kind: "summary" }, wording));
    expect(
      await recordPagePress(
        {
          store: world.store,
          record: world.record,
          now: () => 6_000,
          present: () => undefined,
        },
        "i-0001",
      ),
    ).toEqual({ ok: true, note: "" });
  }

  // The whole of rule 4 in one assertion: the payload, the digest over it, the
  // snapshot it was drawn from and the presentation counted beside it are the
  // same bytes on an English host and on a Japanese one.
  expect(recorded(worlds[1]?.world.connection as DatabaseSync)).toEqual(
    recorded(worlds[0]?.world.connection as DatabaseSync),
  );
  // Not vacuously, in both directions: each press did write, and the two hosts
  // were reading genuinely different documents when they pressed.
  expect(rows(worlds[0]?.world.connection as DatabaseSync, "proposal")).toBe(1);
  expect(rows(worlds[1]?.world.connection as DatabaseSync, "proposal")).toBe(1);
  expect(drawn[1]).not.toBe(drawn[0]);
});

test("a ja host reads in Japanese and leaves every token in its own bytes", async () => {
  const world = await waitingWorld();
  const ja = chromeFor("ja");
  const ports = {
    ...portsOver(world, "ada", []),
    material: async () => await Promise.resolve(asText("why it stopped")),
  };
  const summary = await operatorPage(ports, "t", { kind: "summary" }, ja);
  const requests = await operatorPage(ports, "t", { kind: "requests" }, ja);

  // Prose, on the screens the operator actually reads.
  expect(summary).toContain("あなたの番");
  expect(summary).toContain("あなたの返事を待っています");
  expect(summary).toContain("描き直しは何も書き込みません");
  expect(requests).toContain("何を頼みますか");

  // **Tokens, verbatim and in the middle of the translated sentences** (rule 2
  // and rule 3): what the operator types, and what they match against the
  // store, `rondo show` and continuo's own output.
  expect(summary).toContain("approve");
  expect(summary).toContain("awaiting_human");
  expect(summary).toContain("gate-i-0001");
  expect(summary).toContain("i-0001");
  // Nothing is transliterated, glossed, or given a parenthesis.
  expect(summary).not.toContain("ロンド");
  // Material is still quoted byte for byte, under the tag its plan asked for.
  expect(summary).toContain("重みが足りない");
  expect(summary).toMatch(/<pre class="material[^"]*" lang="ja">/);

  // **What the ledger records stays English even here** (rule 4): the claim
  // labels beside the button are the bytes a press stores.
  expect(summary).toContain("approve を押すと");
  expect(summary).toMatch(/<dt class="label[^"]*">request<\/dt>/);
});

test("<html lang> names the set rondo wrote, and never the tag that was asked for", async () => {
  const world = await waitingWorld();
  const declared = async (wording: Chrome): Promise<string> =>
    /<html lang="([^"]*)">/.exec(
      await operatorPage(portsOver(world, "ada", []), null, { kind: "summary" }, wording),
    )?.[1] ?? "";

  expect(await declared(EN)).toBe("en");
  expect(await declared(chromeFor("ja"))).toBe("ja");
  expect(await declared(chromeFor("JA"))).toBe("ja");
  // **A well-formed tag this tree ships no wording for.** The page is English,
  // so it says `en`: rondo does not declare an intention as a fact (rule 7).
  expect(await declared(chromeFor("de-CH-1901"))).toBe("en");
  expect(await declared(chromeFor(null))).toBe("en");
});

test("every view is complete under each of the three answers to the language question", async () => {
  // Unset, a tag with no wording, and a tag with one: three hosts, three views
  // each, and the same page in all nine -- rule 9's partial set is shippable
  // because a missing string is the English one and never a missing screen.
  const world = await waitingWorld();
  for (const wording of [chromeFor(null), chromeFor("de-CH-1901"), chromeFor("ja")]) {
    const ports = {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("why it stopped")),
    };
    const views = [
      await operatorPage(ports, "t", { kind: "summary" }, wording),
      await operatorPage(ports, "t", { kind: "requests" }, wording),
      await operatorPage(
        ports,
        "t",
        { kind: "thread", messageId: "req-i-0001", to: null },
        wording,
      ),
    ];
    for (const html of views) {
      expect(html).toContain(`<html lang="${wording.lang}">`);
      expect(html).toContain(wording.yourTurn);
      expect(html).toContain("</html>");
      // No key went missing on the way through a set that does not hold it.
      expect(html).not.toContain("undefined");
    }
    // The way into a new request, and the button with its note.
    expect(views[1]).toContain(wording.emptyAsk);
    expect(views[0]).toContain(wording.approvePlain);
    expect(views[0]).toContain(`title="${wording.approveNote("gate-i-0001", "approve")}"`);
    // Every undetermined claim is still beside the press, inside its one fold.
    expect(views[0]).toContain('<details id="undetermined"');
  }
});

/**
 * D-0056: the chrome's language follows the browser and is remembered, and the
 * resolution is never silent.
 *
 * Three groups, and they are three different kinds of claim. **The five steps**
 * are a pure function and are asserted as one, each step winning over the one
 * below it and losing to the one above. **The redirect and the cookie** are
 * properties of a response and are asserted over a socket, because "one 303
 * and no loop" and "no `Set-Cookie` on this one" are claims about wire bytes.
 * **What the press records** is asserted against the database, for D-0055 rule
 * 4's reason with the query, the cookie and the header added to it (rule 13).
 */

/** The tag one served document declares about itself (rule 7). */
function declaredIn(html: string): string {
  return /<html lang="([^"]*)">/.exec(html)?.[1] ?? "";
}

test("a cookie that is not a tag is ignored and does not take the server down", async () => {
  // **`decodeURIComponent` throws on `lang=%`**, and `resolveLanguage` runs
  // synchronously in the request callback -- outside the two promise handlers
  // -- so decoding the value would end the process rather than ignore a
  // preference. The cookie jar for `localhost` is shared with whatever else on
  // this machine has served a page, so this header is not rondo's to trust.
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, "ja"));

  for (const cookie of ["lang=%", "lang=%zz", "lang=", "lang", "lang=ja%2DJP", "other=%"]) {
    const answered = await get(base, "/?lang=ja", { cookie });
    expect(answered.status).toBe(200);
    expect(declaredIn(answered.body)).toBe("ja");
  }
  // Still serving, which is the whole of the claim.
  expect((await get(base, "/?lang=ja")).status).toBe(200);

  stop.abort();
  expect(await served).toBe(0);
});

test("the resolution is never silent: one 303 names the set, and a request naming it is served", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, "ja"));

  // **A bare `/` gains one** (rule 4): the operator can read, copy, bookmark
  // and change whatever rondo resolved, which is the whole answer to a header
  // being invisible on the screen it changes.
  const bare = await get(base, "/");
  expect(bare.status).toBe(303);
  expect(bare.location).toBe("/?lang=ja");

  // **`?lang=ja-JP` is canonicalised to the set it actually reached**, and
  // `?lang=de` to whatever the remaining steps answered.
  expect((await get(base, "/?lang=ja-JP")).location).toBe("/?lang=ja");
  expect((await get(base, "/?lang=de")).location).toBe("/?lang=ja");
  // An ill-formed tag is not a refusal: it resolves to nothing and the address
  // is redirected to the tag of the set that answered (rule 9).
  expect((await get(base, "/?lang=!!")).location).toBe("/?lang=ja");

  // **The no-loop property, asserted rather than reasoned about**: the
  // redirect's target is served, because a set's own tag resolves to itself.
  const arrived = await get(base, "/?lang=ja");
  expect(arrived.status).toBe(200);
  expect(arrived.location).toBeNull();
  expect(declaredIn(arrived.body)).toBe("ja");
  // The same for English, in both directions of the switch (rule 8).
  const english = await get(base, "/?lang=en");
  expect(english.status).toBe(200);
  expect(declaredIn(english.body)).toBe("en");

  // The view survives the canonicalisation, so a redirect never costs the
  // operator their place.
  expect((await get(base, "/?requests=open")).location).toBe("/?requests=open&lang=ja");
  expect((await get(base, "/?thread=req-i-0001")).location).toBe("/?thread=req-i-0001&lang=ja");

  // **The bytes depend on two request headers now, and a shared cache is
  // entitled to know.**
  expect(arrived.vary).toBe("accept-language, cookie");

  stop.abort();
  expect(await served).toBe(0);
});

test("<html lang> names the set rondo wrote whichever of the four inputs chose it (rule 7)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // The header, which is the input D-0055 refused and this entry takes.
  expect(declaredIn((await get(base, "/?lang=ja", { "accept-language": "ja-JP" })).body)).toBe(
    "ja",
  );
  // The cookie, and the query naming what it resolved to.
  expect(declaredIn((await get(base, "/?lang=ja", { cookie: "lang=ja-JP" })).body)).toBe("ja");
  // **Nothing a request carries can make the document lie**: a browser asking
  // for German gets English and a document saying `en`.
  const german = await get(base, "/", { "accept-language": "de" });
  expect(german.location).toBe("/?lang=en");
  expect(declaredIn((await get(base, "/?lang=en", { "accept-language": "de" })).body)).toBe("en");

  stop.abort();
  expect(await served).toBe(0);
});

test("the memory is one cookie, written by a switch and by nothing else (rule 5)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // **A switch**: this URL asked for a language the remaining steps would not
  // have answered, which is what the link in the chrome produces.
  const switched = await get(base, "/?lang=ja");
  expect(switched.status).toBe(200);
  expect(switched.cookie).toContain("lang=ja");
  // The four attributes rule 5 names, and an expiry in months rather than a
  // session -- a switch answers *what language do you read*, not *this tab*.
  expect(switched.cookie).toContain("Path=/");
  expect(switched.cookie).toContain("SameSite=Strict");
  expect(switched.cookie).toContain("HttpOnly");
  expect(switched.cookie).toMatch(/Max-Age=\d{7,}/);

  // **Not on a response whose language the other steps would have given
  // anyway**: an address arrived at by canonicalisation is not a switch.
  expect((await get(base, "/?lang=ja", { cookie: "lang=ja" })).cookie).toBeNull();
  expect((await get(base, "/?lang=en")).cookie).toBeNull();
  const remembered = await serving(portsOver(world, "ada", null, "ja"));
  expect((await get(remembered.base, "/?lang=ja")).cookie).toBeNull();
  remembered.stop.abort();
  expect(await remembered.served).toBe(0);

  // **`?lang=de` over a remembered `ja` lands on `/?lang=ja` and leaves the
  // memory as it was** -- the case a credential-less redraw would otherwise
  // morph to English five seconds after it rendered. `?lang=!!` does the same.
  for (const asked of ["/?lang=de", "/?lang=!!"]) {
    const over = await get(base, asked, { cookie: "lang=ja" });
    expect(over.status).toBe(303);
    expect(over.location).toBe("/?lang=ja");
    expect(over.cookie).toBeNull();
  }
  // And the switch goes back: `en` is a tag any step may name (rule 8).
  expect((await get(base, "/?lang=en", { cookie: "lang=ja" })).cookie).toContain("lang=en");

  // **htmx's redraw is not a switch**: it is a same-origin XHR that sends and
  // stores cookies, so a tab left on `ja` would otherwise rewrite the memory
  // another tab just switched to `en`, every five seconds.
  for (const poll of [
    { "hx-request": "true" },
    { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" },
  ]) {
    expect((await get(base, "/?lang=ja", { cookie: "lang=en", ...poll })).cookie).toBeNull();
  }
  expect(
    (
      await get(base, "/?lang=ja", {
        cookie: "lang=en",
        "sec-fetch-mode": "navigate",
      })
    ).cookie,
  ).toContain("lang=ja");

  stop.abort();
  expect(await served).toBe(0);
});

test("every address a ja page composes for itself carries ja (rule 11)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing", "ja");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed, "ja"));

  const summary = (await get(base, "/?lang=ja")).body;
  const opened = (await get(base, "/?requests=open&lang=ja")).body;
  const answering = summary;

  // The list's links, the way into a new request, and the poll's own address.
  expect(summary).toContain('href="/?thread=req-i-0001&amp;lang=ja"');
  expect(summary).toContain('href="/?requests=open&amp;lang=ja"');
  expect(opened).toContain('href="/?lang=ja"');
  expect(summary).toContain('hx-get="/?lang=ja"');
  expect(opened).toContain('hx-get="/?requests=open&amp;lang=ja"');
  // The form's action.
  expect(answering).toContain('action="/?lang=ja"');

  // **And the `303` after a press**, which is the address the operator actually
  // lands back on: a redirect that dropped the tag would re-resolve the page
  // the moment rondo told them something was written.
  const token = tokenIn(answering);
  const answered = await post(
    base,
    { token, iteration: "i-0001", request: "req-i-0001" },
    { origin: base },
  );
  expect(answered.status).toBe(303);
  expect(answered.location).toBe("/?thread=req-i-0001&lang=ja");
  expect(pressed).toEqual([{ iterationId: "i-0001", body: "approve" }]);

  stop.abort();
  expect(await served).toBe(0);
});

test("the switch is a link in the chrome, one per shipped set other than the one on screen (rule 10)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // **Labelled with that language's own name in its own language**, which is
  // what makes the label the same bytes in every set -- and the link carries
  // the view, so switching never costs the reader their place.
  const english = (await get(base, "/?lang=en")).body;
  expect(english).toContain('<a href="/?lang=ja" lang="ja">日本語</a>');
  expect(english).not.toContain(">English<");

  const japanese = (await get(base, "/?lang=ja")).body;
  expect(japanese).toContain('<a href="/?lang=en" lang="en">English</a>');
  expect(japanese).not.toContain(">日本語<");

  // On every view, because a path the operator cannot find is a safeguard
  // present in the markup and absent in practice.
  const opened = (await get(base, "/?requests=open&lang=en")).body;
  expect(opened).toContain('<a href="/?requests=open&amp;lang=ja" lang="ja">日本語</a>');

  stop.abort();
  expect(await served).toBe(0);
});

test("the resolved set reaches the material port and not only the chrome (rule 12)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  // The port is handed the set the *request* resolved to, so the fence block's
  // standing sentences follow the page rather than the host it was started on.
  const asked: string[] = [];
  const ports: ServedPorts = {
    ...portsOver(world, "ada", [], "en"),
    material: async (wording) => {
      asked.push(wording.lang);
      return await Promise.resolve(asText(`set     ${wording.lang}`));
    },
  };
  const { base, stop, served } = await serving(ports);

  expect((await get(base, "/?answer=i-0001&lang=ja")).body).toContain("set     ja");
  expect((await get(base, "/?answer=i-0001&lang=en")).body).toContain("set     en");
  expect(asked).toEqual(["ja", "en"]);

  stop.abort();
  expect(await served).toBe(0);
});

test("the bytes a press records depend on neither the query, the cookie nor the header (rule 13)", async () => {
  // D-0055 rule 4's assertion with this entry's three new inputs added to it:
  // one ledger, one wording of one claim, whatever the page read like. Each
  // host reaches `ja` by a *different* one of the three, so what is asserted is
  // the invariant and not one input being ignored.
  const reachedJaBy: Record<string, string>[] = [
    { cookie: "lang=ja" },
    { "accept-language": "ja-JP" },
    {},
  ];
  const worlds = [];
  for (const [at, headers] of reachedJaBy.entries()) {
    const world = await waitingWorld();
    // The third host is the query's: `?lang=ja` with nothing else saying so.
    const { base, stop, served } = await serving(portsOver(world, "ada", [], null));
    const drawn = await get(base, at === 2 ? "/?answer=i-0001&lang=ja" : "/?answer=i-0001", {
      ...headers,
      ...(at === 2 ? {} : { cookie: headers.cookie ?? "" }),
    });
    // Whichever input chose it, the page that was read was Japanese.
    const body =
      drawn.status === 200 ? drawn.body : (await get(base, drawn.location ?? "/", headers)).body;
    expect(declaredIn(body)).toBe("ja");
    expect(
      await recordPagePress(
        {
          store: world.store,
          record: world.record,
          now: () => 6_000,
          present: () => undefined,
        },
        "i-0001",
      ),
    ).toEqual({ ok: true, note: "" });
    stop.abort();
    expect(await served).toBe(0);
    worlds.push(world);
  }

  // One assertion over three hosts: the payload, the digest over it, the
  // snapshot it was drawn from and the presentation counted beside it are the
  // same bytes whichever of rule 2's steps chose the language.
  const first = recorded(worlds[0]?.connection as DatabaseSync);
  for (const world of worlds.slice(1)) {
    expect(recorded(world.connection as DatabaseSync)).toEqual(first);
  }
  // Not vacuously: each press did write.
  for (const world of worlds) {
    expect(rows(world.connection as DatabaseSync, "proposal")).toBe(1);
  }
});
