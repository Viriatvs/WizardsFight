import type { RpsHand } from '@/types/game';

/** 12x12 pixel maps. Each character is one pixel; '.' is transparent. */
const PIXELS: Record<RpsHand, string[]> = {
  rock: [
    '............',
    '....oooo....',
    '..oohhffoo..',
    '.ohhfffffso.',
    '.ohffffffsso',
    'ohffffffffso',
    'offffffffsso',
    'offfsffffsso',
    'osfffffffsso',
    '.ossfffssso.',
    '..oooooooo..',
    '............',
  ],
  paper: [
    '............',
    '.oooooooooo.',
    '.offffffffo.',
    '.offffffffo.',
    '.ollllllffo.',
    '.offffffffo.',
    '.olllllllfo.',
    '.offffffffo.',
    '.ollllllffo.',
    '.offffffffo.',
    '.oooooooooo.',
    '............',
  ],
  scissors: [
    '.h........h.',
    '.hh......hh.',
    '..hh....hh..',
    '...hh..hh...',
    '....hhhh....',
    '.....oo.....',
    '....hhhh....',
    '...rr..rr...',
    '.rrrr..rrrr.',
    'rr..r..r..rr',
    'rr..r..r..rr',
    '.rrr....rrr.',
  ],
};

// Art colors, matched to the stone/bone/torch palette in docs/design.md.
const COLORS: Record<RpsHand, Record<string, string>> = {
  rock: { o: '#16120e', f: '#7a6e60', h: '#a89a88', s: '#4a4238' },
  paper: { o: '#16120e', f: '#f4efe6', l: '#8a7f70' },
  scissors: { o: '#16120e', h: '#c9cdd2', r: '#c0392b' },
};

export const RPS_NAMES: Record<RpsHand, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

/** Pixel-art rock, paper or scissors. With a label it's announced as an image; without, it's decorative. */
export default function RpsIcon({ hand, size = 64, label }: { hand: RpsHand; size?: number; label?: string }) {
  const rects = PIXELS[hand].flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '.' ? [] : [<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLORS[hand][c]} />])),
  );
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {rects}
    </svg>
  );
}
