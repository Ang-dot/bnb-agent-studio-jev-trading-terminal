import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {PositionBook} from "./PositionBook.js";
describe("position plan labels",()=>{
  it("shows paused exits and no fake mark when prices are missing",()=>{
    const html=renderToStaticMarkup(<PositionBook positions={[{pool:"p",token:"t",name:"TOKEN",quantity:50,costUsd:50,openedAt:1}]} launches={[]} now={100} running={false} onSelect={()=>{}}/>);
    expect(html).toContain("Exits paused");expect(html).toContain("Fresh mark unavailable");expect(html).toContain("TP1 +50%");
  });
});
