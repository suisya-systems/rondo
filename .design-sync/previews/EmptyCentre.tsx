/** @jsxImportSource react */
import { chromeFor, EmptyCentre } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");

export const Default = () => (
  <EmptyCentre
    wording={ja}
    composer={
      <form className="space-y-2">
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-body"
          rows={4}
          placeholder="何をしてほしいか書いてください"
        />
      </form>
    }
  />
);

export const NeverLooked = () => (
  <EmptyCentre wording={ja} composer={null} since={{ kind: "never" }} />
);
