export const ASSESSMENT_PACING = Object.freeze({
  windowMs: 60000,
  startsPerMinute: 30,
  inventoryReserve: 10,
});

// Reserve immediately before a JEV call, never for a cache hit, duplicate or failed research.
// No rolling-hour lockout. Existing engines still serialize work within each edition.
export class AssessmentPacer {
  private starts: {at:number;inventory:boolean}[] = [];
  constructor(private now=Date.now) {}
  reserve(inventory: boolean): boolean {
    const now=this.now(), p=ASSESSMENT_PACING;
    this.starts=this.starts.filter(s=>s.at<=now&&s.at>now-p.windowMs);
    if(this.starts.length>=p.startsPerMinute || (!inventory&&this.starts.filter(s=>!s.inventory).length>=p.startsPerMinute-p.inventoryReserve)) return false;
    this.starts.push({at:now,inventory});
    return true;
  }
}
