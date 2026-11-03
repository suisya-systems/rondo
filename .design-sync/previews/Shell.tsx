/** @jsxImportSource react */
import { Shell } from "@suisya-systems/rondo-page";

export const MixedFaces = () => (
  <Shell
    list={{ react: <p className="p-3 text-body">依頼の一覧</p> }}
    thread={{ react: <p className="p-3 text-body">スレッドと回答欄</p> }}
    side={{ rendered: '<p class="p-3 text-body">サーバーで描いた右の面</p>' }}
  />
);
