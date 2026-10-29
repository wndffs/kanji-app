export const WAVE07_REVIEW_DECISION = {
  schemaVersion: 1,
  wave: "foundation-wave-07",
  reviewedAt: "2026-10-29",
  decision: "approved-ai-editorial",
  humanReviewed: false,
  publicationApproved: false,
  reviewers: [
    {
      role: "A",
      scope: "20 word meanings, accepted answers, original examples and translations",
    },
    {
      role: "B",
      scope: "9 components, 10 kanji and selected word-reading explanations",
    },
  ],
  proposalFingerprint: "24f8b3f225186d17686c489a3113f8af40efe07a4b8d8bb53f9aa355461d4cdd",
  sourceFingerprint: "007e2a5593b48b3bd77742c13f761dd1d6ca332843307346f6d2752003065240",
  kanjiSha256: "c29f311e3f05cd03e1b12a232bc660bfcd7a548a689ff76c798ab7d56313ae06",
  wordsSha256: "8a7c53c07b87b31ecfa27173731c8213f755a3349332f40ef5372c46e521ebf4",
  counts: {
    components: 9,
    kanji: 10,
    words: 20,
    examples: 20,
    cards: 69,
  },
} as const;
