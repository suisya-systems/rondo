/**
 * A pull request body as a forge draws it, with nothing in it that runs or
 * fetches (rondo#248).
 *
 * **GitHub-flavoured, because what the screen shows is how the forge will show
 * it.** micromark with its GFM extension is CommonMark and GFM to the spec:
 * tables, task lists, strikethrough, footnotes, literal autolinks.
 *
 * **What passes and what does not.** The body is the lap's words -- commit
 * subjects, paths, a quoted request -- so it is untrusted markdown:
 *
 * - **Raw HTML: none.** micromark's `allowDangerousHtml` is left off, so every
 *   tag is escaped as the text it is. The one piece of HTML rondo writes itself,
 *   the request fold, is recognised by its shape and drawn by the page
 *   (`requestFold` in web.tsx); it is never handed here as markup.
 * - **Links** keep only `http`, `https`, `mailto`, `irc`, `ircs` and `xmpp`
 *   (micromark's own sanitising, `allowDangerousProtocol` left off); any other
 *   scheme becomes an empty `href`. A kept link opens in a new tab, so
 *   following one does not take the reader off the screen a press is made from,
 *   and carries no referrer.
 * - **Images are not fetched.** The page's `default-src 'self'` would refuse a
 *   remote one anyway, and a fetch would tell whoever serves it that this was
 *   read. An image is drawn as a link to where it is, named by its alt text.
 *
 * The last two are made on the HTML micromark returns rather than inside it:
 * its media handler keeps its state where an extension cannot reach, and every
 * character of content in that HTML is already escaped, so the only `<a href="`
 * and `<img src="` in it are ones micromark wrote.
 */
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

const NEW_TAB = 'target="_blank" rel="noopener noreferrer"';

/**
 * `text` as HTML that is safe to put on the page as it stands.
 *
 * A link whose address micromark refused is its text alone, and so is an
 * image whose address it refused. An image inside a link is its name, since a
 * link cannot hold a link. A link within the body (a footnote's `#...`) stays
 * in this tab.
 */
export function markdownHtml(text: string): string {
  const html = micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
  return html
    .replace(
      /<img src="([^"]*)" alt="([^"]*)"(?: title="[^"]*")? \/>/g,
      (_, src: string, alt: string, at: number) => {
        const before = html.slice(0, at);
        const inLink = before.split("<a ").length > before.split("</a>").length;
        const name = alt === "" ? src : alt;
        return src === "" || inLink ? name : `<a href="${src}">${name}</a>`;
      },
    )
    .replace(/<a href="">(.*?)<\/a>/gs, "$1")
    .replace(/<a href="(?!#)/g, `<a ${NEW_TAB} href="`);
}
