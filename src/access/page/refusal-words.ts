/**
 * The words a refused `POST` says when nothing more specific does (rondo#702):
 * the approve press's refusals, and the plain-text lines for a form too large,
 * an unknown address and a page asked for under another host name. They were
 * English literals in `web-app.ts` (D-0056's fourth residual), so a Japanese
 * page answered a stale press in English and asked the person to reload.
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and each
 * set spreads its half in, so `satisfies Chrome` still fails on a missing word.
 *
 * **None asks the person to reload**: since rondo#674 an open tab picks up the
 * press token of a restarted host, so a fresh press is the way on.
 */

/**
 * Why a press carrying a claim answered nothing, as the wording key the page
 * says it in (rondo#220 S2 review). A person causes these by typing or by
 * answering a gate someone else already did, so they are said in the
 * request's language with the way back to the gate.
 */
export type ClaimRefusal =
  | "claimTooLong"
  | "claimGateUnread"
  | "claimGateClosed"
  | "claimNotRecorded"
  /**
   * The one of these the person did not cause: the write failed on an errno,
   * so pressing again changes nothing until this machine is repaired
   * (rondo#349, `D-0076` rule 4.3).
   */
  | "claimHostSetup";

/** Why an approve press answered nothing before or besides a claim, said on the same page. */
export type ApproveRefusal =
  | "approveRefusedNoApprover"
  | "approveRefusedPress"
  | "approveRefusedForm"
  | "approveRefused";

export type RefusalWords = { readonly [K in ApproveRefusal]: string } & {
  /** A press or a flow answer over its size limit, as plain text. */
  readonly formTooLarge: string;
  readonly notFound: string;
  /** A request under a host name other than this machine's (`421`). */
  readonly notThisMachine: string;
};

export const REFUSAL_EN: RefusalWords = {
  approveRefusedNoApprover:
    "Nothing was approved: nobody is named as the approver yet. Name them at the top of the page, then press approve again.",
  approveRefusedPress:
    "Nothing was approved: the page was out of date when you pressed. Press approve again.",
  approveRefusedForm:
    "Nothing was approved: the form arrived incomplete. Go back to the gate and press approve again.",
  approveRefused: "Nothing was approved. Go back to the gate to see where it stands.",
  formTooLarge:
    "Nothing was sent: what you wrote is longer than this page takes. Shorten it and press again.",
  notFound: "There is nothing at this address.",
  notThisMachine: "rondo shows this page only at 127.0.0.1 or localhost. Open it there.",
};

export const REFUSAL_JA: RefusalWords = {
  approveRefusedNoApprover:
    "承認していません。承認する人がまだ決まっていません。画面の上部で名前を入れてから、もう一度「承認する」を押してください。",
  approveRefusedPress:
    "承認していません。押したときに画面が古くなっていました。もう一度「承認する」を押してください。",
  approveRefusedForm:
    "承認していません。送られた内容に足りない部分がありました。確認の画面に戻って、もう一度「承認する」を押してください。",
  approveRefused: "承認していません。確認の画面に戻って、いまの状態を確かめてください。",
  formTooLarge:
    "送っていません。書いた内容がこの画面で受け取れる長さを超えています。短くしてから、もう一度押してください。",
  notFound: "このアドレスにはページがありません。",
  notThisMachine:
    "rondo はこの画面を 127.0.0.1 または localhost でだけ表示します。そちらのアドレスで開いてください。",
};
