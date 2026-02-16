const GLOBE_EMOJI = "\u{1F310}";

export const getFlagEmoji = (countryCode: string) => {
  const normalized = (countryCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return GLOBE_EMOJI;

  const codePoints = normalized.split("").map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};
