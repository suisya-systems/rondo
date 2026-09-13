# lap 9 runbook -- 本人が rondo に直接話しかけて、スコープ承認の下で最初の lap を回す

lap 8 までは claude-org のワーカーが rondo の verb を打ち、本人の判断は窓口経由で中継していた
（[`lap-8-dogfood.md`](lap-8-dogfood.md) N-25 / N-28）。lap 9 では **本人が自分の端末で rondo を
直接操作する**。D-0069 (#213) で「最初の lap の前にスコープを承認し、その lap をスコープ内で
admit する」順序が歩けるようになり、#205（#209 で修正）で dogfood 環境の plan に review criterion が
入ったので、モデルレビューも走る。

測りたいこと: **rondo を通した自己開発は、今の組織（窓口 + ワーカー）より手間が少ないか。**

## 0. 今回のリクエスト: rondo#197

**選んだもの: [rondo#197](https://github.com/suisya-systems/rondo/issues/197)
"A basis form for a scope row, so the durable stop's bases name the scope (D-0066 4.4)"**

選んだ理由:

- **判断が済んでいる。** 2026-09-13 の human gate で「#196 はそのまま merge し、欠けている basis
  form をここで足す」と決まっている。やることも本文に書かれている（Basis union と store の
  locator に `scope` 形を足し、thread writer で検証し、stop メッセージの bases に載せる）。
- **小さく、テストで決着する。** 既存の basis form（`continuoRun` 等）は `src/advisory/proposal.ts`、
  `src/store/sqlite.ts`、`src/access/advisory.ts`、`src/access/cli.ts`、`src/access/conductor.ts` の
  数か所に並んでいて、同じ形で 1 つ足す作業になる。stop の bases にスコープが載ることは
  `test/access/scope-stop.test.ts` で確かめられる。
- 除外した候補: #206（返信の意味の設計判断が先）、#199（画面の見せ方の判断が要る）、#200
  （推奨案 (b) が「実際に失われた報告が観測されたら」の条件付き）、#204 / #179（どちらも決める
  ことが先）、#36（実使用のエビデンス待ち）、#89（どの作業をどの tier に回すかの判断が要る）、
  #159（言語の問いかけ文言の判断）。
- 注意: #197 には「D-0066 に #196 の読み（line は lineage tree）を注記する」も含まれる。
  worker がドキュメント注記まで入れるかどうかはゲートで確認する。

## 1. 用意済みの環境

すべて `/tmp/claude-1000/rondo-dogfood-lap-9-env` の下にある（`/tmp` なので **マシン再起動で消える**）。

| パス | 中身 |
|---|---|
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-host` | rondo 本体（GitHub から clone、`ad019db` = #213 の merge、build 済み）。**コマンドはここで打つ** |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-gh` | lap が触る対象リポジトリ（GitHub から clone、`ad019db`、origin は `suisya-systems/rondo`） |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/env.sh` | `RONDO_CONTINUO_CLI` / `RONDO_STORE` / `RONDO_APPROVER=happy_ryo` |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/plan.json` | `scripts/dogfood-env.sh --target-repo` が生成した plan（review criterion 入り、手編集なし） |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/request.txt` | #197 の本文 + AGENTS.md の作業順（pin check → `npm ci --ignore-scripts` → 変更とテスト → `npm run verify` → commit、push しない） |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/continuo-fcf86eb…/` | pin された continuo の build |
| `/tmp/claude-1000/rondo-dogfood-lap-9-env/verify/` | 準備時の確認に使った **別の** store（本番の `RONDO_STORE` とは別。触らなくてよい） |

環境は次のコマンドで作った（再実行しても壊れない）:

```
git clone https://github.com/suisya-systems/rondo.git /tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-gh
git clone https://github.com/suisya-systems/rondo.git /tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-host
/tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-host/scripts/dogfood-env.sh \
  --root /tmp/claude-1000/rondo-dogfood-lap-9-env \
  --target-repo /tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-gh --iteration-id lap9-001
```

## 2. 始める前の注意

- **Claude Code のサンドボックスの中ではなく、普通の端末で打つ**（N-21）。サンドボックス内から
  `start` すると worker 側のサンドボックスが `EPERM` で起動に失敗した（lap 6 / 7）。
- **お金がかかるのは `start`（と、使った場合の `retry` / `revise`）だけ。** `publish` は GitHub に
  push して PR を開く。それ以外（`request` / `scope` / `decide-scope` / `answer` の表示 / `inbox` /
  `explain`）はお金も外部への作用もない。
- `(node:NN) ExperimentalWarning: SQLite is an experimental feature` は毎回出るが無害。
- 各ステップの時刻は `date +%T` で記録シート（6 節）に書く。

## 3. 手順

### Step 1. 環境を読み込む

```sh
cd /tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-host
. /tmp/claude-1000/rondo-dogfood-lap-9-env/env.sh
R=/tmp/claude-1000/rondo-dogfood-lap-9-env; date +%T
```

rondo-host に移動し、rondo が使う 3 つの環境変数と `$R` を設定する（何も書き込まない）。

### Step 2. リクエストを開く

```sh
node bin/rondo.mjs request --actor-id happy_ryo --message-id lap9-req-197 --body="$(cat $R/request.txt)"
```

`opened request 'lap9-req-197'` と出て、#197 の依頼が会話スレッドの根メッセージとして保存される。
（中身を変えたい場合は先に `$R/request.txt` を編集する。）

### Step 3. スコープ案を書いて記録する（`rondo scope --plan`）

提案する予算値と根拠。**承認するか、値を変えるかは本人が決める**（変えるなら下のコマンドの
数字を書き換えてから打つ）。

| 項目 | 提案値 | 根拠 | 手放すもの |
|---|---|---|---|
| `requests` | `[lap9-req-197]` | 今回のリクエスト 1 件 | -- |
| `workspaces` | `(rondo-gh, workspaces)` | plan の `repository` / `workspace_root` そのまま | -- |
| `agent_types` | `sha256:0fc3ca25…4942e` | `scope --plan` がこの plan から出す digest（準備時に確認済み、lap 8 と同じ） | -- |
| `laps` | 2 | 最初の lap 1 回 + スコープ内のやり直し 1 回 | 3 回目は新しい承認が要る |
| `review_rounds` | 2 | agent type の `loopPolicy.maxReviewRounds` が 2 | 2 回目の指摘で line が止まる |
| `cost_reserve_usd` | 2.50 | コード変更 lap の実績 1.03 / 7.06 / 2.06 / 1.54 / 0.89 / 1.04（lap 2-5, 7, 8）。lap 3 以外は収まる | 目安にすぎない。超えても lap は途中で止まらず、レビュアーのコストは数えない |
| `cost_usd` | 5.00 | reserve 2 回分 | lap 3 並みの lap は止まらずに越え、次の act が拒否される |
| `expires_at_ms` | 今から 6 時間後 | 今日中に終わる歩き | 以後は後継スコープが要る |
| `severity_threshold` | `major`（既定） | D-0065 rule 2.2 | -- |
| `outward_acts` | なし | `publish` は本人が打つ | push / PR は常に本人の手 |

```sh
cat > $R/scope.json <<EOF
{"requests":["lap9-req-197"],
 "workspaces":[{"repository":"$R/rondo-gh","workspace_root":"$R/workspaces"}],
 "agent_types":["sha256:0fc3ca257bac9293524ce48d4739c5ad4c2c01eca670106442008b8035e4942e"],
 "budgets":{"laps":2,"review_rounds":2,"cost_usd":5,"cost_reserve_usd":2.5,
            "expires_at_ms":$(node -e 'console.log(Date.now()+6*3600*1000)')},
 "severity_threshold":"major","outward_acts":[]}
EOF
node bin/rondo.mjs scope --payload-file $R/scope.json --actor-id happy_ryo --plan $R/plan.json
```

スコープ行が記録され、`recorded as scope 'scope-…'`、`digest: sha256:…`、予算、agent type の
tier (`standard`) と granted keys (`command.run`) が表示される。**まだ承認ではない。**
最後の `Next:` 行に次のコマンドがそのまま出る。

- `agent type ... does not list it` と拒否された場合: plan の digest が変わっている。拒否文の
  `plan ...: agent type sha256:…` の値で `scope.json` の `agent_types` を置き換えて打ち直す
  （拒否時は何も記録されない）。

### Step 4. スコープを承認する（P1、本人の判断）

画面の内容を読んで、よければ `Next:` 行の `ID` を `happy_ryo` にして打つ:

```sh
node bin/rondo.mjs decide-scope --scope-id <scope-…> --scope-digest <sha256:…> --actor-id happy_ryo --outcome approved
```

`recorded as scope decision 'scope-decision-…'` と出る。この **scope-decision id を控える**。
承認しない場合は `--outcome declined`（Step 3 からやり直し、値を変えるなら新しいスコープを書く）。

### Step 5. スコープの下で最初の lap を走らせる（お金がかかる）

```sh
date +%T
node bin/rondo.mjs start --plan $R/plan.json --iteration-id lap9-001 \
  --prompt-file $R/request.txt --message-id lap9-req-197 --scope-decision-id <scope-decision-…>
date +%T
```

スコープの全テストを通れば worker が起動し、実装して、ゲートで止まって戻ってくる（lap 8 は約
130 秒、$1.04）。`It came from the request opened by message lap9-req-197`、コスト行、
`model review` 行（今回は review criterion があるので `unavailable` にならないはず）が出る。
スコープで拒否された場合は `Refused: ... at the <test> test` と出て、**何も admit されず、お金も
かかっていない**（4 節「止まったとき」を参照）。

### Step 6. ゲートを読む

```sh
node bin/rondo.mjs answer --iteration-id lap9-001
```

worker の説明（why）、commit（work）、fence、レビュー（deterministic とモデル）が表示される。
何も書き込まない。

### Step 7. 外から確かめる（任意だが推奨）

```sh
git -C $R/workspaces/iter-lap9-001 log --oneline -3
git -C $R/workspaces/iter-lap9-001 status --porcelain
git -C $R/workspaces/iter-lap9-001 show --stat HEAD
npm --prefix $R/workspaces/iter-lap9-001 run verify; echo EXIT=$?
```

lap の commit、未 commit の残り（空のはず）、差分の範囲を見て、fence の外でテストを走らせる。

### Step 8. ゲートに答える（本人の判断）

```sh
node bin/rondo.mjs answer --iteration-id lap9-001 --actor-id happy_ryo \
  --verified="read the diff; npm run verify in the workspace EXIT=0" --body=approve
```

ゲートが閉じ、`iteration 'lap9-001' is closed`、`Gate outcome: answered_and_forwarded` と出る。
`--verified` は実際にやったことに合わせて書き換える（PR 本文に載る）。直してほしい点がある場合は
`answer` の代わりに `revise --actor-id happy_ryo --iteration-id lap9-002 --body="..."`（お金がかかる）。

### Step 9. 公開する（任意）

```sh
node bin/rondo.mjs publish --iteration-id lap9-001 --repo suisya-systems/rondo --actor-id happy_ryo --dry-run
node bin/rondo.mjs publish --iteration-id lap9-001 --repo suisya-systems/rondo --actor-id happy_ryo
```

1 行目は push 先・PR の中身を表示するだけ。2 行目で `rondo/lap9-001` を push し、PR を開き、
continuo の run を閉じる（**GitHub に本人名義で出る**）。

## 4. 止まったとき（stop が来たとき）

- `start` / `retry` がスコープで拒否されると、リクエストのスレッドに `asks` 付きのメッセージ
  （`scope-stop-…`）が書かれ、**返信するまでその line の次の admit は止まる**。拒否文に
  理由・選択肢・推奨が出る。
- 読む: `node bin/rondo.mjs inbox --actor-id happy_ryo`、または `node bin/rondo.mjs explain --iteration-id lap9-001`。
- 続ける場合: 原因に応じて（予算切れなら値を変えた後継スコープを `scope --supersedes-scope-id` で
  書いて承認、作業の問題なら plan / request を直す）、そのうえで stop に返信する:

```sh
node bin/rondo.mjs reply --actor-id happy_ryo --message-id lap9-stop-reply-1 --in-reply-to <scope-stop-…> --body="..."
```

- **注意（#206）: どんな文面の返信でも stop は解除される。** 「止める」と書いても、次の admit は
  最初からテストされる。止めたいだけなら返信せずに置いておく（害はない）か、下の abandon を使う。
- lap が走ったまま戻らない・壊れた場合: `node bin/rondo.mjs abandon --iteration-id lap9-001 --reason "..."`。

## 5. 片付け

- 公開した場合、continuo の run は `publish` が閉じる。公開しない場合は
  `node bin/rondo.mjs abandon --iteration-id lap9-001 --reason "not published"`。
- 承認済みスコープは `expires_at_ms`（6 時間後）で失効する。何もしなくてよい。
- ディレクトリは本人の判断で削除: `rm -rf /tmp/claude-1000/rondo-dogfood-lap-9-env`
  （`rondo-gh` の `rondo/lap9-001` ブランチはローカルにしかない。publish 前に消すと作業も消える）。

## 6. 記録シート

各ステップの時刻、考え込んだ回数（手が止まって判断・調べものをした回数）、詰まったところを書く。

| Step | 開始時刻 | 終了時刻 | 考えた回数 | 詰まったところ・メモ |
|---|---|---|---|---|
| 1 環境読み込み | | | | |
| 2 request | | | | |
| 3 scope 記録（予算値を決める） | | | | |
| 4 decide-scope（P1） | | | | |
| 5 start（lap） | | | | |
| 6 ゲートを読む | | | | |
| 7 外から確認 | | | | |
| 8 answer | | | | |
| 9 publish（任意） | | | | |
| stop 対応（あれば） | | | | |

全体:

- request から answer までの時間:
- 本人が判断を求められた回数（P1、ゲート、stop 返信など）:
- lap のコスト（`start` の出力の USD）:
- 今の組織（窓口にタスクを頼んでワーカーが PR を出す）と比べて、手間は少なかったか・その理由:

## 7. 準備時の確認結果（2026-09-13、お金のかからない範囲）

`/tmp/claude-1000/rondo-dogfood-lap-9-env/verify/` の **別 store**（`rondo-iterations-verify.sqlite3`）で
確認した。本番の `RONDO_STORE` には何も書いていない。スコープの承認と `start` 以降は打っていない。

| 確認 | 結果 |
|---|---|
| `scripts/dogfood-env.sh --target-repo ...` | EXIT 0。continuo `fcf86eb` を build・版を検証、plan に `review_criterion` あり |
| `npm run preflight:model-tier -- $R/plan.json` | `model tier 'standard' runs on claude-opus-5` |
| `request --message-id verify-req-197 --body="$(cat request.txt)"` | `opened request 'verify-req-197'`、EXIT 0 |
| `scope --plan` にダミー digest の payload | EXIT 2、`plan ...: agent type sha256:0fc3ca257bac…4942e` を表示し、何も記録せず拒否。**digest を事前に知る手段として使える** |
| `scope --plan` に上の digest を入れた payload（Step 3 と同じ値） | EXIT 0、`recorded as scope ...`、tier `standard` / granted `command.run`、予算表示、`Next: rondo decide-scope ...` |
| `start --scope-decision-id bogus`（`--message-id` なし） | 引数解析で拒否: `start --scope-decision-id needs --message-id ID ...`、EXIT 2 |
| `start --dry-run` | `'--dry-run' is not a flag of 'start'` で拒否（`start` に dry-run はない） |
| `answer`（表示のみ） | `Nothing is waiting. No iteration is live.` |
| このブランチで `npm run verify`（`env.sh` を読み込んで） | EXIT 0、46 files passed / 1 skipped、1171 passed / 5 skipped |
| 確認後の verify store | `iteration` 0 行、`scope_decision` 0 行、`agent_type_record` 1 行（記録したスコープの分） |

気づいた点（lap 9 の記録候補）:

- **承認待ちのスコープは `inbox` に出ない。** スコープ記録後の `inbox` は「waiting on you」が
  proposals と iterations だけで、Step 4 の判断が待っていることは表示されない。控えは `scope` の
  画面の `Next:` 行だけになる。
- `scope --plan` は digest を表示するが、payload に digest を書く必要があるので、初回はダミー
  digest で 1 回拒否させて読む手順になる（今回は準備時に読んだ値を Step 3 に入れてある）。
