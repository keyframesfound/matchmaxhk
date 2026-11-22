/** Pre-filled Ops message: names only the other tutor's PUBLIC code (Cap. 57). */
export function conciergeReferMessage(input: {
  language: string;
  targetCode: string;
  myCode: string | null;
}): string {
  const zh = input.language.toLowerCase().startsWith("zh");
  if (zh) {
    return [
      "你好 MatchMax，我想透過顧問合作轉介 / 合作。",
      `對方導師編號：${input.targetCode}`,
      input.myCode ? `我的導師編號：${input.myCode}` : null,
      "想合作的內容：",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Hi MatchMax, I'd like to refer / partner with another tutor via Concierge.",
    `Their tutor code: ${input.targetCode}`,
    input.myCode ? `My tutor code: ${input.myCode}` : null,
    "What I have in mind:",
  ]
    .filter(Boolean)
    .join("\n");
}
