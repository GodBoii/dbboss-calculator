export const BET_COPY_FORMAT_STORAGE_KEY = "lakshmi-boss:bet-copy-format"
export const BET_COPY_TEXT_STYLE_STORAGE_KEY = "lakshmi-boss:bet-copy-text-style"

export const BET_COPY_FORMATS = [
  { id: "dash", label: "Classic dash", separator: "-", preview: "123-124-125" },
  { id: "double-dash", label: "Double dash", separator: "--", preview: "123--124--125" },
  { id: "en-dash", label: "Long dash", separator: "–", preview: "123–124–125" },
  { id: "em-dash", label: "Extra-long dash", separator: "—", preview: "123—124—125" },
  { id: "space", label: "Clean spaces", separator: "  ", preview: "123  124  125" },
  { id: "slash", label: "Slash /", separator: "/", preview: "123/124/125" },
  { id: "backslash", label: "Backslash", separator: "\\", preview: "123\\124\\125" },
  { id: "pipe", label: "Line |", separator: "|", preview: "123|124|125" },
  { id: "double-pipe", label: "Double line ||", separator: "||", preview: "123||124||125" },
  { id: "double-slash", label: "Double slash //", separator: "//", preview: "123//124//125" },
  { id: "double-backslash", label: "Double backslash", separator: "\\\\", preview: "123\\\\124\\\\125" },
  { id: "equals", label: "Equals =", separator: "=", preview: "123=124=125" },
  { id: "bang", label: "Exclamation", separator: "!", preview: "123!124!125" },
  { id: "bullet", label: "Bullet", separator: " • ", preview: "123 • 124 • 125" },
  { id: "lines", label: "New lines", separator: "\n", preview: "123\n124\n125" },
] as const

export type BetCopyFormatId = (typeof BET_COPY_FORMATS)[number]["id"]
export const DEFAULT_BET_COPY_FORMAT: BetCopyFormatId = "dash"

export const BET_COPY_TEXT_STYLES = [
  { id: "normal", label: "Normal", prefix: "", suffix: "" },
  { id: "bold", label: "Bold", prefix: "*", suffix: "*" },
  { id: "italic", label: "Italic", prefix: "_", suffix: "_" },
  { id: "monospace", label: "Monospace", prefix: "```", suffix: "```" },
] as const

export type BetCopyTextStyleId = (typeof BET_COPY_TEXT_STYLES)[number]["id"]
export const DEFAULT_BET_COPY_TEXT_STYLE: BetCopyTextStyleId = "normal"

export function isBetCopyFormatId(value: string | null): value is BetCopyFormatId {
  return BET_COPY_FORMATS.some((format) => format.id === value)
}

export function getSavedBetCopyFormat(): BetCopyFormatId {
  if (typeof window === "undefined") return DEFAULT_BET_COPY_FORMAT
  const saved = window.localStorage.getItem(BET_COPY_FORMAT_STORAGE_KEY)
  return isBetCopyFormatId(saved) ? saved : DEFAULT_BET_COPY_FORMAT
}

export function saveBetCopyFormat(format: BetCopyFormatId) {
  window.localStorage.setItem(BET_COPY_FORMAT_STORAGE_KEY, format)
}

export function isBetCopyTextStyleId(value: string | null): value is BetCopyTextStyleId {
  return BET_COPY_TEXT_STYLES.some((style) => style.id === value)
}

export function getSavedBetCopyTextStyle(): BetCopyTextStyleId {
  if (typeof window === "undefined") return DEFAULT_BET_COPY_TEXT_STYLE
  const saved = window.localStorage.getItem(BET_COPY_TEXT_STYLE_STORAGE_KEY)
  return isBetCopyTextStyleId(saved) ? saved : DEFAULT_BET_COPY_TEXT_STYLE
}

export function saveBetCopyTextStyle(style: BetCopyTextStyleId) {
  window.localStorage.setItem(BET_COPY_TEXT_STYLE_STORAGE_KEY, style)
}

/** Changes presentation only. Numeric tokens and their order are preserved. */
export function formatBetForCopy(
  rawBet: string,
  format = getSavedBetCopyFormat(),
  textStyle = getSavedBetCopyTextStyle(),
): string {
  const tokens = rawBet.match(/\d+/g) ?? []
  if (tokens.length === 0) return rawBet

  const selected = BET_COPY_FORMATS.find((item) => item.id === format) ?? BET_COPY_FORMATS[0]
  const style = BET_COPY_TEXT_STYLES.find((item) => item.id === textStyle) ?? BET_COPY_TEXT_STYLES[0]
  const formatted = `${style.prefix}${tokens.join(selected.separator)}${style.suffix}`
  const formattedTokens = formatted.match(/\d+/g) ?? []

  return tokens.join("\u0000") === formattedTokens.join("\u0000") ? formatted : rawBet
}

export function convertStandardBetText(
  input: string,
  format: BetCopyFormatId,
  textStyle: BetCopyTextStyleId,
): { output: string; betCount: number } {
  const originalTokens = input.match(/\d+/g) ?? []
  if (originalTokens.length === 0) throw new Error("Paste at least one bet before generating.")

  const selected = BET_COPY_FORMATS.find((item) => item.id === format)
  const style = BET_COPY_TEXT_STYLES.find((item) => item.id === textStyle)
  if (!selected || !style) throw new Error("Select a valid conversion style.")

  const output = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const tokens = line.match(/\d+/g) ?? []
      if (tokens.length === 0) return ""
      const convertedLine = tokens.join(selected.separator)
      return `${style.prefix}${convertedLine}${style.suffix}`
    })
    .join("\n")
    .trim()

  const outputTokens = output.match(/\d+/g) ?? []
  if (originalTokens.join("\u0000") !== outputTokens.join("\u0000")) {
    throw new Error("Safety check failed. No formatted result was created.")
  }

  return { output, betCount: originalTokens.length }
}
