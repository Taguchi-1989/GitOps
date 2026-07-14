import { AimsSourceChunk } from './types';

const DEFAULT_CHUNK_CHARS = 16_000;
const DEFAULT_MAX_CHUNKS = 6;

export class AimsSourceTooLargeError extends Error {
  constructor(
    readonly chunkCount: number,
    readonly maxChunks: number
  ) {
    super(
      `Evidence requires ${chunkCount} review chunks, exceeding the configured maximum of ${maxChunks}. Split the evidence or increase AIMS_MAX_REVIEW_CHUNKS.`
    );
    this.name = 'AimsSourceTooLargeError';
  }
}

export function normalizeAimsSource(source: string): string {
  return source.replace(/\r\n?/g, '\n').normalize('NFC').trim();
}

export function chunkAimsSource(
  source: string,
  options: { maxChars?: number; maxChunks?: number } = {}
): AimsSourceChunk[] {
  const maxChars =
    options.maxChars ?? readPositiveInt('AIMS_REVIEW_CHUNK_CHARS', DEFAULT_CHUNK_CHARS);
  const maxChunks =
    options.maxChunks ?? readPositiveInt('AIMS_MAX_REVIEW_CHUNKS', DEFAULT_MAX_CHUNKS);
  if (maxChars < 1 || maxChunks < 1) throw new Error('AIMS chunk limits must be positive');

  const normalized = normalizeAimsSource(source);
  const lines = normalized.split('\n');
  const units: Array<{ line: number; text: string }> = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const prefix = `[L${lineNumber}] `;
    const available = Math.max(1, maxChars - prefix.length - 16);
    if (prefix.length + line.length <= maxChars) {
      units.push({ line: lineNumber, text: `${prefix}${line}` });
      return;
    }
    for (let offset = 0, part = 1; offset < line.length; offset += available, part += 1) {
      units.push({
        line: lineNumber,
        text: `[L${lineNumber} part ${part}] ${line.slice(offset, offset + available)}`,
      });
    }
  });

  const chunks: AimsSourceChunk[] = [];
  let current: Array<{ line: number; text: string }> = [];
  let currentLength = 0;
  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      index: chunks.length,
      startLine: current[0].line,
      endLine: current[current.length - 1].line,
      text: current.map(unit => unit.text).join('\n'),
    });
    current = [];
    currentLength = 0;
  };

  for (const unit of units) {
    const addition = unit.text.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && currentLength + addition > maxChars) flush();
    current.push(unit);
    currentLength += addition;
  }
  flush();

  if (chunks.length > maxChunks) throw new AimsSourceTooLargeError(chunks.length, maxChunks);
  return chunks;
}

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
