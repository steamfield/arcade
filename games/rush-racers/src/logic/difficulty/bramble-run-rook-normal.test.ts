/** The Normal bars on Bramble Run as Rook, in a file of its own so Vitest races the characters in parallel. */
import { describeNormal } from './normal-bars.ts';

describeNormal('rook', 'bramble-run');
