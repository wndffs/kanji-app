import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { PRONUNCIATION_RECORDINGS, PRONUNCIATION_WAVE_ID } from "@kanji-srs/shared";
import { withNeonConnectionDefaults } from "../src/connection-defaults";
import { verifyPronunciationWav } from "../src/pronunciation-media";

const SOURCE_NAME = "Lingua Libre pronunciation 445-459";
const LICENSE_NAME = "CC BY 4.0 (Lingua Libre pronunciation)";
type Reader = Pick<Prisma.TransactionClient, "word" | "learningItem" | "audioAsset" | "dataSource" | "license">;

export async function planPronunciation(db: Reader) {
  const plans = [];
  for (const entry of PRONUNCIATION_RECORDINGS) {
    const bytes=await readFile(new URL(`../../../apps/web/public${entry.publicPath}`,import.meta.url));
    verifyPronunciationWav(bytes,entry);
    const word=await db.word.findUnique({where:{expression_reading:{expression:entry.expression,reading:entry.reading}},include:{importedRecord:{include:{importRun:true}}}});
    if (!word || word.importedRecord?.sourceRecordId !== entry.sourceRecordId || word.importedRecord.importRun.status !== "SUCCESS") throw new Error("Exact imported pronunciation word is unavailable.");
    const item=await db.learningItem.findUnique({where:{targetType_targetId:{targetType:"WORD",targetId:word.id}}});
    if (!item || item.status !== "PUBLISHED") throw new Error("Pronunciation requires a published learning item.");
    const existing=await db.audioAsset.findUnique({where:{id:entry.id}});
    if (existing && (existing.learningItemId !== item.id || existing.checksumSha256 !== entry.checksumSha256 || existing.status !== "PUBLISHED" || existing.mediaUrl !== `https://kanji-app-rho.vercel.app${entry.publicPath}`)) throw new Error("Existing recording collision; do not overwrite.");
    const license=await db.license.findUnique({where:{name:LICENSE_NAME}});
    const source=await db.dataSource.findUnique({where:{name:SOURCE_NAME}});
    if (license && (license.scope !== "OPEN_DATA" || license.url !== entry.licenseUrl)) throw new Error("License collision.");
    if (source && (source.homepageUrl !== entry.sourceUrl || source.licenseId !== license?.id)) throw new Error("Source collision.");
    plans.push({entry,itemId:item.id,existing:existing?.id ?? null});
  }
  return plans;
}

export async function applyPronunciation(prisma: PrismaClient) {
  await planPronunciation(prisma);
  return prisma.$transaction(async db=>{
    const plans=await planPronunciation(db);
    for (const {entry,itemId,existing} of plans) {
      if (existing) continue;
      const license=await db.license.upsert({where:{name:LICENSE_NAME},update:{},create:{name:LICENSE_NAME,spdxLikeId:"CC-BY-4.0",scope:"OPEN_DATA",url:entry.licenseUrl,requiresAttribution:true}});
      const source=await db.dataSource.upsert({where:{name:SOURCE_NAME},update:{},create:{name:SOURCE_NAME,licenseId:license.id,homepageUrl:entry.sourceUrl,downloadUrl:entry.downloadUrl,attributionText:entry.attribution}});
      const run=await db.importRun.upsert({where:{dataSourceId_checksumSha256:{dataSourceId:source.id,checksumSha256:entry.checksumSha256}},update:{},create:{dataSourceId:source.id,checksumSha256:entry.checksumSha256,sourceVersion:PRONUNCIATION_WAVE_ID,sourceFileName:entry.file,sourceDownloadedAt:new Date(`${entry.verifiedAt}T00:00:00Z`),finishedAt:new Date(),status:"SUCCESS",statsJson:{assets:1,sourceDate:entry.sourceDate,sourceUrl:entry.sourceUrl,sourceMetadataVerified:true,humanAcousticCertification:false}}});
      if(run.status !== "SUCCESS") throw new Error("Existing audio import is not successful.");
      await db.audioAsset.create({data:{id:entry.id,learningItemId:itemId,mediaUrl:`https://kanji-app-rho.vercel.app${entry.publicPath}`,storageKey:entry.publicPath,checksumSha256:entry.checksumSha256,durationMs:entry.durationMs,speakerName:entry.speaker,voiceMetadataJson:{origin:"human-recording",expression:entry.expression,reading:entry.reading,verifiedAt:entry.verifiedAt,humanAcousticCertification:false},locale:entry.locale,dataSourceId:source.id,licenseId:license.id,importRunId:run.id,attributionText:entry.attribution,status:"PUBLISHED"}});
    }
    return {status:"applied-pronunciation",assets:plans.length,created:plans.filter(p=>!p.existing).length,learningCardsWritten:0,userStateWritten:0};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10_000,timeout:30_000});
}

async function main() {
  const args=process.argv.slice(2);
  if(args.length !== 1 || !["--plan","--apply"].includes(args[0]!)) throw new Error("Choose exactly --plan or --apply.");
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const prisma=new PrismaClient({datasourceUrl:withNeonConnectionDefaults(process.env.DATABASE_URL)});
  try { const result=args[0] === "--apply" ? await applyPronunciation(prisma) : {status:"read-only-pronunciation-plan",assets:(await planPronunciation(prisma)).map(p=>({id:p.entry.id,existing:p.existing !== null}))}; console.log(JSON.stringify(result,null,2)); }
  finally { await prisma.$disconnect(); }
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch((error:unknown)=>{console.error(error);process.exitCode=1;});
