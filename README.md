# rondo

The host application of the successor stack: the one long-running process a person talks to. It owns the record of runs, gates, decisions and the conversation with the operator; it turns a one-line request into admitted runs, drives them, and brings every gate back to the human for a single yes or no. It consumes [continuo](https://github.com/suisya-systems/continuo) (the substrate) and [cadenza](https://github.com/suisya-systems/cadenza) (the delegation contract and gate semantics) as libraries.

Status: the repository is being created; the design it implements is recorded in cadenza's `docs/design/conductor.md` and the decision to host it here is cadenza#40 (C-17, 2026-09-05).

## The name

A rondo is the piece that keeps coming home: a refrain the listener already knows, set between episodes that are free to wander, and the refrain is where the piece is decided - it opens, it returns after every excursion, and it has the last word. That is what this application is, not what it performs: the one place the human ever speaks to, and the one record everything else is played from. Each delegated run is an episode that leaves it and is cued back to it, and every return is a gate - the refrain does not resume until the human has said yes or no, and it accepts that answer exactly once. Continuo underpins the whole piece and cadenza defines the solo; rondo is where the piece always returns.
