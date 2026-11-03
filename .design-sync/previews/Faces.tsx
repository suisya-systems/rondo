/** @jsxImportSource react */
import { Faces } from "@suisya-systems/rondo-page";

export const ThreeFaces = () => (
  <Faces
    list={<p className="p-3 text-body">依頼の一覧</p>}
    thread={<p className="p-3 text-body">スレッドと回答欄</p>}
    side={<p className="p-3 text-body">合意内容と材料</p>}
  />
);
