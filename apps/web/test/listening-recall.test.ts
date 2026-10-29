import { describe, expect, it } from "vitest";
import { type ItemDetails } from "@kanji-srs/shared";
import { gradeListeningRecall } from "../src/lib/listening-recall";
describe("ungraded recorded-word rehearsal",()=>{
  const item=()=>({pronunciationAudio:{id:"recording"},cards:[{id:"reading",promptType:"reading",answerType:"reading",acceptedAnswers:[{text:"たべる"}],blockedAnswers:[]}],userOverrides:[]}) as unknown as ItemDetails;
  it("uses precise kana validation without scheduling mutations",()=>{
    const before=item(); const snapshot=JSON.stringify(before);
    expect(gradeListeningRecall(before,"タベル").accepted).toBe(true);
    expect(gradeListeningRecall(before,"たべます").accepted).toBe(false);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it("honors scoped personal answers and explicit block precedence",()=>{
    const personal={...item(),userOverrides:[{learningCardId:"reading",kind:"accepted-answer",text:"たべます"},{learningCardId:"other",kind:"accepted-answer",text:"くう"}]} as unknown as ItemDetails;
    expect(gradeListeningRecall(personal,"たべます").accepted).toBe(true);
    expect(gradeListeningRecall(personal,"くう").accepted).toBe(false);
    expect(gradeListeningRecall({...personal,userOverrides:[...personal.userOverrides,{learningCardId:"reading",kind:"blocked-answer",text:"たべます"}]} as ItemDetails,"たべます").result).toBe("blocked");
  });
});
