import { describe, it, expect } from "vitest";
import {
  LaunchFeed,
  parseTrenches,
  parseLaunchCandles,
  parseLaunchActivity,
  parseTokenActivity,
} from "./launch-feed.js";
const address = `0x${"a".repeat(40)}`;
const row = {
  address,
  chain: "bsc",
  launchpad_platform: "flap",
  symbol: "A",
  name: "A",
  price: 0.01,
  progress: 0.5,
  created_timestamp: 1_790_000_000,
};
describe("GMGN discovery boundary", () => {
  it('shares token-wide candles for a held token after it leaves launch discovery', async () => {
    let calls = 0;
    const feed = new LaunchFeed(async () => { calls++; return {list:[{time:1790000000000,open:'1',high:'2',low:'1',close:'2',volume:'10'}]}; });
    await expect(feed.candles(address, '5')).rejects.toThrow('Unknown token');
    const results = await Promise.all([feed.tokenCandles(address,'5'),feed.tokenCandles(address,'5')]);
    expect(results[0]).toHaveLength(1); expect(results[1]).toEqual(results[0]); expect(calls).toBe(1);
  });
  it("retains recently graduated tokens even when newer creations fill the bounded queue", async () => {
    const now = Date.now();
    const graduate = {
      ...row,
      address: `0x${"f".repeat(40)}`,
      created_timestamp: now / 1000 - 864000,
      complete_timestamp: now / 1000 - 60,
    };
    const feed = new LaunchFeed(async (args) =>
      args.includes("flap")
        ? {
            new_creation: Array.from({ length: 650 }, (_, i) => ({
              ...row,
              address: `0x${i.toString(16).padStart(40, "0")}`,
              created_timestamp: now / 1000 - i,
            })),
            near_completion: [],
            completed: [graduate],
          }
        : { new_creation: [], near_completion: [], completed: [] },
    );
    await feed.refresh();
    expect(feed.state.launches).toHaveLength(600);
    expect(
      feed.state.launches.some((l) => l.address === graduate.address),
    ).toBe(true);
  });
  it("reads five-minute rank activity without substituting missing fields or other windows", () => {
    const result = parseLaunchActivity(
      {
        code: 0,
        data: {
          rank: [
            {
              ...row,
              volume: 2200,
              swaps: 21,
              buys: 10,
              sells: 11,
              is_honeypot: 0,
              is_wash_trading: false,
              rug_ratio: 0,
            },
            {
              ...row,
              address: `0x${"b".repeat(40)}`,
              volume_24h: 90000,
              swaps_24h: 500,
            },
            { ...row, chain: "eth" },
          ],
        },
      },
      1000,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      volume5mUsd: 2200,
      swaps5m: 21,
      observedAt: 1000,
    });
    expect(result[1]).toMatchObject({ volume5mUsd: null, swaps5m: null });
    expect(() => parseLaunchActivity({ data: { tokens: [] } }, 1000)).toThrow();
  });
  it("queries only the supported Flap and Four.meme platforms", async () => {
    const queried: string[] = [];
    const feed = new LaunchFeed(async (args) => {
      queried.push(args[args.indexOf("--launchpad-platform") + 1]);
      return { new_creation: [], near_completion: [], completed: [] };
    });
    await feed.refresh();
    expect(queried).toEqual(["flap", "fourmeme"]);
    expect(feed.state.coverage.flap.status).toBe("empty");
  });
  it("accepts the observed CLI shape, deduplicates stages, and never claims verification", () => {
    const result = parseTrenches(
      { new_creation: [row], near_completion: [row], completed: [row] },
      "flap",
      1_790_000_001_000,
    );
    expect(result).toHaveLength(1);
    expect(result[0].stage).toBe("graduated_reported");
    expect(result[0].liquidityUsd).toBeNull();
    expect(result[0].createdAt).toBe(1_790_000_000_000);
  });
  it("rejects GraFun and only accepts exact BSC platform labels", () => {
    const other = { ...row, launchpad_platform: "grafun" };
    const result = parseTrenches(
      {
        new_creation: [row, { ...row, chain: "eth" }, other],
        near_completion: [],
        completed: [other],
      },
      "flap",
      Date.now(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      platform: "flap",
      stage: "new",
      id: `56:${address}`,
    });
  });
  it("isolates platform failures without discarding other feeds", async () => {
    let fail = false;
    const feed = new LaunchFeed(async (args) => {
      const platform = args[args.indexOf("--launchpad-platform") + 1];
      if (platform === "fourmeme" && fail) throw new Error("provider error");
      return {
        new_creation: [
          {
            ...row,
            address: `0x${(platform === "fourmeme" ? "b" : "a").repeat(40)}`,
            launchpad_platform: platform,
          },
        ],
        near_completion: [],
        completed: [],
      };
    });
    await feed.refresh();
    expect(feed.state.coverage.fourmeme.status).toBe("observed");
    fail = true;
    await feed.refresh();
    expect(feed.state.coverage.fourmeme).toMatchObject({
      status: "unavailable",
      count: null,
    });
    expect(feed.state.coverage.flap.status).toBe("observed");
    expect(feed.state.errors).toEqual([
      "Four.meme feed unavailable. Retaining timestamped observations.",
    ]);
    expect(feed.state.launches.some((l) => l.platform === "fourmeme")).toBe(
      true,
    );
  });
  it("rejects wrong chains, platforms and malformed addresses", () => {
    expect(
      parseTrenches(
        {
          new_creation: [
            { ...row, chain: "eth" },
            { ...row, launchpad_platform: "other" },
            { ...row, address: "--help" },
          ],
          near_completion: [],
          completed: [],
        },
        "flap",
        Date.now(),
      ),
    ).toEqual([]);
  });
  it("fails closed on schema drift instead of reporting an empty successful feed", () => {
    expect(() =>
      parseTrenches({ data: { pump: [row] } }, "flap", Date.now()),
    ).toThrow();
  });
  it("keeps risk flags explicit without treating absent fields as safe", () => {
    const [result] = parseTrenches(
      {
        new_creation: [
          { ...row, is_honeypot: "yes", is_wash_trading: true, rug_ratio: 0.7 },
        ],
        near_completion: [],
        completed: [],
      },
      "flap",
      Date.now(),
    );
    expect(result.riskFlags).toContain("GMGN honeypot flag");
  });
  it("normalizes observed millisecond klines, sorts/deduplicates and drops future or invalid bars", () => {
    const bar = {
      time: 1_790_000_000_000,
      open: "1",
      high: "2",
      low: "0.5",
      close: "1.5",
      volume: "5",
      amount: "3",
    };
    const result = parseLaunchCandles(
      {
        list: [
          bar,
          bar,
          { ...bar, time: 1_790_001_000_000 },
          { ...bar, open: "oops" },
        ],
      },
      1_790_000_050_000,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ time: 1_790_000_000, volume: 5 });
  });
});

it('supplements ranking gaps with bounded exact-token five-minute activity',async()=>{
 const now=Date.now(),calls:string[][]=[];
 const feed=new LaunchFeed(async args=>{calls.push(args);return args[0]==='market'?{code:0,data:{rank:[]}}:
 {address,price:{address,volume_5m:'400',swaps_5m:8,buys_5m:6,sells_5m:2,volume_1h:'99999'}};});
 feed.state.launches=parseTrenches({new_creation:[{...row,liquidity:2500,holder_count:20}],near_completion:[],completed:[]},'flap',now);
 expect((await feed.activity())[0]).toMatchObject({token:address,volume5mUsd:400,swaps5m:8,buys5m:6,sells5m:2});
 expect(calls.filter(a=>a[0]==='token')).toHaveLength(1);
 expect(parseTokenActivity({address,price:{address,volume_1h:'99999'}},address,now).volume5mUsd).toBeNull();
 expect(()=>parseTokenActivity({address,price:{address:'wrong'}},address,now)).toThrow('identity');
});

it('refreshes execution candles inside the chart cache window while normal UI reads remain cached',async()=>{
 let calls=0;const at=Date.now();
 const feed=new LaunchFeed(async()=>{calls++;return {list:[{time:at-60000,open:'1',high:'2',low:'1',close:String(calls===1?1:2),volume:'10'}]};});
 expect((await feed.tokenCandles(address,'1'))[0].close).toBe(1);
 expect((await feed.tokenCandles(address,'1'))[0].close).toBe(1);expect(calls).toBe(1);
 expect((await feed.tokenCandles(address,'1',{fresh:true}))[0].close).toBe(2);expect(calls).toBe(2);
});
