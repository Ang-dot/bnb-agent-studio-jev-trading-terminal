# Aggressive narrative-first paper profile

The reference is [CCPiggy_'s September review](https://x.com/CCPiggy_/status/2105192838770348109), using the post text supplied by the operator. Its useful rules are early entries on appealing narratives/tickers, recovering principal at a double, staged runner sales, avoiding fragmented copycat battles and accepting missed upside. The post also attributes results to market conditions. The supplied PnL screenshot is not a verified performance record or a backtest for this implementation.

## Explicit interpretations

- “Around 20k” is interpreted as **market cap**, with an experimental $15k–$25k zone. It is not a liquidity target. A token can also qualify within 25% of its observed recent low. A measured chase exceeding 100% from that low blocks entry even inside the cap zone.
- The recent low uses five minutes of GMGN token candles for new/bonding launches and thirty minutes for graduates, with at least three observations spanning two minutes and last candle coverage ending within 90 seconds. One-minute candles retain their original opening timestamps; range freshness includes that known one-minute interval. Execution prices still require their own ≤90-second trade/receipt checks. The shorter pre-graduation window permits an observed local base after initial curve growth; it does not remove the 100% spike limit or turn a rising launch into a known bottom. Historical assessments without a recorded window retain their original thirty-minute interpretation. It is a historical range, not a known bottom. Missing history remains unknown; a fresh cap-zone observation can still qualify.
- “80% likely” is the author's subjective conviction. JEV's probe/add model-score floors is an experimental application setting, not an 80% launch probability or promised win rate.
- “200% / 300%” means +200% / +300% return (3× / 4×). “Sell 15%” means 15% of the originally acquired tokens at each step, including all pre-recovery adds. These are explicit choices where the post is ambiguous.

## Entry and hold behavior

New, bonding and GMGN-reported graduated Flap / Four.meme launches can enter monitoring. Creation (new/bonding) or graduation must be within 24 hours; initial screening observations within 90 seconds. Once admitted, an assessment may continue with launch, activity and market-verification observations up to five minutes old while research and memory recall finish. Pause, stop, missing-token and changed screening checks still cancel it, with a specific recorded reason. Paper execution retains the 90-second attention and price checks, so a completed JEV judgment can be recorded without a fill when attention has aged out. The attention floor is $2,000 reported liquidity, ten holders, $300 volume and five swaps in five minutes, with no reported hard-risk flags. Eligible tokens can be reassessed after 60 seconds. Each edition selects one candidate per 30-second tick, subject to provider latency; there is no hourly assessment lockout. A shared pacer allows 30 actual JEV calls per minute, with ten places reserved for held positions. Bounded feed coverage can omit tokens; absence is not zero activity.

Grok 4.3 researches the exact CA, ticker/name/description fit, cultural hooks or current catalysts, originality and timing. Token spread stays separate from broader themes. Every buy needs a coherent angle, supported fit, accepted CA or theme context and fresh positive 5m buying. News events, verified originality, descriptions and KOL amplification are optional. Unknowns remain explicit; CA posts cannot bypass fit.

Same-ticker rivalry alone permits a $25 probe. Accepted CA-linked differentiation can support normal add sizing; cited copycat confusion blocks entries. Every initial order is $25. DEX adds can use $50 with a profitable thesis and existing limits.

JEV selects BUY/SELL/HOLD. Initial probes require BUY preference ≥0.55, separate confidence ≥0.40, quality ≥1.25/3; adds require ≥0.65 and ≥1.5/3. Material deception/manipulation risk must be ≤0.40. Ordinary promotion and missing facts alone do not establish manipulation. Location, fresh flow and portfolio limits still apply. Healthy winners may HOLD; no trade quota or displayed-PnL objective.

| Setting | Value |
| --- | --- |
| Initial probe / launch add | $25 before fees |
| DEX add to strength | $50 before fees |
| Fee-inclusive token cap | $75 launch simulation / $150 DEX |
| Slots / aggregate remaining entry cost | 10 / lesser of $1,000 and 50% of starting capital |
| Entry liquidity | $2,000 reported launch liquidity / $5,000 DEX pool liquidity |
| Adds | Fresh BUY, +5% modeled net strength, 60-second cooldown, at most three entries; no averaging down or adds after trimming |
| Daily entry pause | $400 gross realized losses per UTC day; exits remain available |

## Principal and runner accounting

At +100% modeled net return, sell enough to recover **invested cash including modeled entry fees**, net of modeled exit fees/slippage. This can be less than half the tokens if price jumps above the trigger. At +200% and +300%, sell 15% of original tokens each time. The remaining position trails 25% below its recorded net peak after principal recovery. These code exits are labeled separately from JEV decisions.

A −20% net stop applies. Before principal recovery, a position aged at least 15 minutes with nonpositive net return and more observed sells than buys can rotate out. There is no age-only exit for a profitable winner. JEV may sell a broken thesis earlier. Missing/stale marks do not create fills. A recovered principal calculation does not make execution or future returns guaranteed.

Positions persist original acquired quantity, invested cash and cumulative net proceeds. Partial exits preserve proportional remaining accounting cost; returns for the ladder use the original weighted entry basis. Existing positions reconstruct that basis from matching opening-lot fills when possible; incomplete history conservatively treats the remaining lot as unrecovered. Historical fills are not rewritten.

## Pre-graduation price boundary

Launch fills use a distinct `launch:<token>` paper identity and `gmgn-paper` source. They are **indicative token-mark simulations**, not curve transactions, router quotes or confirmed DEX trades. `marketAt=0` means unavailable; the UI shows the receipt instead. GMGN's provider price-as-of is unknown. Modeled launch costs are 1% fee plus 3% adverse slippage per side; DEX simulations retain 0.3% plus 0.5%. These fixed assumptions exclude taxes, gas, API costs, curve depth and failed fills.

A held launch simulation retains its identity and cost basis after graduation, following fresh token marks from the same feed and recording the new stage. It never silently converts into DEX inventory. The one-token rule prevents a second pool position for that token. If the token disappears from the feed or observations expire, prices/exits become unavailable until fresh observations return. DEX positions continue to require matching-pool trade evidence.

Memory records keep indicative observations distinct from timestamped DEX trades. Five- and thirty-minute follow-ups preserve their source and unknown price time; they do not establish executable returns or causal memory benefit. Real execution remains locked. No deployment or session arming is implied by changing this profile.

## Active paper revision
Initial entries are $25 probes (BUY preference ≥0.55, separate confidence ≥0.40, quality ≥1.25); DEX adds retain $50, ≥0.65 and ≥1.5. Every buy needs supported metadata fit, a coherent cultural angle, accepted CA or theme context and positive fresh 5m flow. News events, known originality and KOL spread are optional. Material-risk score ≤0.40 now concerns concrete deception/manipulation, not ordinary promotion or missing facts. $400 daily realized loss and existing capital/exit limits remain.

X output has one schema; valid findings survive unrelated invalid fields with visible diagnostics. Authorless citation URLs are unknown authors; post IDs reconcile handle/i URL forms. Missing GMGN descriptions stay unknown; reported post links are unverified research clues. Up to three promising pre-graduation tokens absent from rankings get explicit token-info 5m reads per activity refresh.

After BUY/SELL, refresh price and monitoring admission before the ledger transaction. Keep the assessed snapshot and execution snapshot separately. A BUY price move greater than 5% triggers reassessment. Stop/pause/session changes still win, and cached old trades are never retimestamped.
