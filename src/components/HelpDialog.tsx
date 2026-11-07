import { forwardRef } from "react";
import { GOOD_MS, PERFECT_MS } from "../lib/engine";
import { MAX_BPM, MIN_BPM, PRACTICE_BPM } from "../lib/tempo";

/** Native <dialog> opened with showModal(): it traps focus, closes on Escape and returns focus to the trigger. */
export const HelpDialog = forwardRef<HTMLDialogElement>(function HelpDialog(_props, ref) {
  return (
    <dialog ref={ref} className="help" aria-labelledby="help-title">
      <form method="dialog" className="help-body">
        <h2 id="help-title">How to play</h2>
        <p>
          Notes fall on the beat toward four lanes. Press D, F, J or K, or tap the pads, as each note crosses the line.
        </p>
        <ul>
          <li>
            Perfect: within {PERFECT_MS} ms. Good: within {GOOD_MS} ms. Anything later is a miss.
          </li>
          <li>Hits build your streak. Every 10 in a row raises the score multiplier, up to ×4.</li>
          <li>Misses and taps with no note in reach drain energy. The set ends when energy runs out.</li>
          <li>Press Escape or Pause to stop for a moment.</li>
        </ul>
        <h3>Where the tempo comes from</h3>
        <p>
          A live set reads Squeektoshi’s real wheel from api.squeekchain.com every 3 seconds. One wheel turn is one beat,
          kept between {MIN_BPM} and {MAX_BPM} BPM. If the hamster stays still, the set ends and shows how far the wheel
          turned while you played. Practice keeps a fixed {PRACTICE_BPM} BPM.
        </p>
        <h3>About</h3>
        <p>
          Squeek DJ is a community project for the Squeekchain Buildooooor badge. It has no account, wallet or backend.
          Your best scores and sound setting stay in this browser.
        </p>
        <button className="btn btn-secondary" value="close">
          Close
        </button>
      </form>
    </dialog>
  );
});
