export const TEXT_CANDIDATE_LIMIT = 2048;
export class JapaneseTextBudgetError extends Error {
  constructor(){super("Слишком много словарных кандидатов; сократите текст.");}
}
type WordSegment = {readonly segment:string;readonly index:number;readonly isWordLike?:boolean};
export type TextCandidateAnalysis = {
  readonly normalizedText:string;
  readonly wordCandidates:readonly string[];
  readonly kanjiCharacters:readonly string[];
  readonly analyzer:"icu-word-boundaries"|"bounded-dictionary-fallback";
  readonly boundaries:readonly {start:number;end:number}[];
  readonly sourceOffsets:readonly {start:number;end:number}[];
};

export function extractJapaneseTextCandidates(text:string, options:{readonly segmentWords?:((value:string)=>Iterable<WordSegment>)|null}={}):TextCandidateAnalysis {
  const chunks:{text:string;start:number;end:number}[]=[];
  let sourceIndex=0;
  for(const char of text) {
    const previous=chunks.at(-1);
    if(previous && /^[\p{M}\uff9e\uff9f]$/u.test(char)) {previous.text+=char;previous.end+=char.length;}
    else chunks.push({text:char,start:sourceIndex,end:sourceIndex+char.length});
    sourceIndex+=char.length;
  }
  const sourceOffsets:{start:number;end:number}[]=[];
  const normalizedText=chunks.map(chunk=>{
    const value=chunk.text.normalize("NFKC");
    for(let i=0;i<value.length;i++)sourceOffsets.push({start:chunk.start,end:chunk.end});
    return value;
  }).join("");
  if(normalizedText.length>20_000)throw new JapaneseTextBudgetError();
  const candidates=new Set<string>(),kanji=new Set<string>();
  const boundaries:{start:number;end:number}[]=[];
  const add=(value:string)=>{
    if(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value))return;
    candidates.add(value);
    if(candidates.size>TEXT_CANDIDATE_LIMIT)throw new JapaneseTextBudgetError();
  };
  let analyzer:TextCandidateAnalysis["analyzer"]="bounded-dictionary-fallback";
  const segmentWords=options.segmentWords===undefined ? defaultSegmentWords() : options.segmentWords;
  if(segmentWords) {
    try {
      const observed=[...segmentWords(normalizedText)];
      for(const segment of observed) {
        if(!segment.isWordLike || segment.segment.length>80)continue;
        boundaries.push({start:segment.index,end:segment.index+segment.segment.length});
        add(segment.segment);
      }
      analyzer="icu-word-boundaries";
    } catch(error) {
      if(error instanceof JapaneseTextBudgetError)throw error;
      boundaries.length=0;candidates.clear();
    }
  }
  for(const run of normalizedText.matchAll(/[\p{Letter}\p{Number}ー々〆]+/gu)) {
    const chars=Array.from(run[0]);
    for(let start=0;start<chars.length;start++) {
      const char=chars[start]!;
      if(/\p{Script=Han}/u.test(char))kanji.add(char);
      if(kanji.size>512)throw new JapaneseTextBudgetError();
      for(let length=1;length<=8 && start+length<=chars.length;length++)add(chars.slice(start,start+length).join(""));
    }
  }
  return {normalizedText,wordCandidates:[...candidates],kanjiCharacters:[...kanji],analyzer,boundaries,sourceOffsets};
}

function defaultSegmentWords():((value:string)=>Iterable<WordSegment>)|null {
  if(typeof Intl.Segmenter!=="function" || Intl.Segmenter.supportedLocalesOf(["ja"]).length===0)return null;
  const segmenter=new Intl.Segmenter("ja",{granularity:"word"});
  return value=>segmenter.segment(value);
}

export function originalTextSpan(analysis:TextCandidateAnalysis,start:number,length:number):{start:number;end:number}|null {
  const first=analysis.sourceOffsets[start],last=analysis.sourceOffsets[start+length-1];
  return first && last ? {start:first.start,end:last.end} : null;
}
