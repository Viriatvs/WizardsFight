import type { RpsHand } from '@/types/game';
import PixelIcon, { type PixelIconName } from './PixelIcon';

/** Rock is a stone morning star, paper a spell scroll, scissors two crossed swords. */
const HAND_ICON: Record<RpsHand, PixelIconName> = { rock: 'morningStar', paper: 'scroll', scissors: 'swords' };

export const RPS_NAMES: Record<RpsHand, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

export default function RpsIcon({ hand, size = 64, label }: { hand: RpsHand; size?: number; label?: string }) {
  return <PixelIcon name={HAND_ICON[hand]} size={size} label={label} />;
}
