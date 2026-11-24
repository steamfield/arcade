/** The Normal bars on Thunderhead Pass as Rook, in a file of its own so Vitest races the characters in parallel. */
import { describeNormal } from './normal-bars.ts';

describeNormal('rook', 'thunderhead-pass');
