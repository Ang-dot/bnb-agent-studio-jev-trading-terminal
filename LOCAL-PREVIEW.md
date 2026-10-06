# Memory presentation

Run `npm run dev:site -- --port 4173 --strictPort` to open the frontend at `http://127.0.0.1:4173/token2049`.

Use this frontend-only command for the presentation. The separate `dev` and `start` commands launch the backend and are not needed. Research, monitoring and trading remain paused.

## Pages

- `/` redirects to `/token2049`.
- `/token2049` shows four educational cases, BNB-COIN1 through BNB-COIN4.
- `/token2049/architecture` explains the component workflow.
- `/token2049/build` plays the Codex / Claude agent-creation conversation.
- `/kbw` retains the separate legacy terminal.

A case can be selected with `/token2049?case=coin1&step=2`. The same placeholder selection follows the chart, brain, decision comparison and architecture record. Unknown or older case IDs fall back to the first presentation case. Session state uses a separate presentation key.

## Presentation scope

Token names and icons are placeholders for this demo. BNB Chain does not endorse the tokens shown. The demonstration is for education, not financial advice or a recommendation to trade.

The historical candle values, time ranges and recorded model outputs are retained. Names, images, contracts, participant identities and identifying source links are replaced or omitted from the frontend and public downloads. Generalized evidence notes illustrate the remembered relationships. Published JSON files are explicitly labelled redacted presentation records; they are not original model request/response receipts. Original research is retained locally outside the published application and Git commit.

The display shows WATCH with current evidence and ENTRY with added prior context from three paired historical evaluations per case. ENTRY is the presentation label for the original `entry_candidate` output. Percentages are model-choice probabilities, not win rates. The original policy tested narrative context, not measured community response or price causality. No new model evaluation or trade is performed by this site.

## Controls

- Select any chart or use the arrow buttons to change the focused case.
- Expand a chart or the interactive brain for presentation. Select a memory node or chart event to inspect generalized context.
- Chart ranges are inside each chart: Period, Story and Event. Select the current range again to refit after panning. The period intervals remain 1D, 4H, 1H and 1H respectively.
- Toggle memory to compare the recorded outputs. Enter the decision record to inspect the historical policy and redacted output data.
- In the CLI page, Enter, Space or Down advances, Up reverses, and Home restarts. At the memory choice, 1 attaches Living Brain and 2 keeps the local journal. The Codex/Claude toggle preserves progress.

Valuations are estimated FDV from historical USD prices multiplied by archived total supply. Historical circulating supply is unverified. The displayed ratio runs from the assessment-time reference to the selected period high; the endpoint was selected retrospectively. Costs, fills and holding policies were not tested.

The Living Brain handoff is reconstructed historical context, not a recorded native provider run. The cursor-responsive 3D brain uses an adapted Brainder cortical mesh under CC BY-SA 3.0; see `src/token2049/brain-assets/NOTICE.md`.

## Checks and publication

Run `npm test`, `npm run check:repo` and `npm run build`. Tests verify the placeholder identities, public record scope, unchanged numerical candle snapshots, timing and output calculations. Scan the production bundle and staged source for identifying details before publication. Local research, original materials, QA screenshots and credentials are excluded from Git.
