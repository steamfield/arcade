/**
 * The Chromium launch flags every headless game run uses, shared by the Playwright projects and
 * the `arcade see` / `arcade attract` sessions so all of them render the same way.
 */

/**
 * Lets headless Chromium render WebGL in software (SwiftShader) and on GPUs it would otherwise
 * blocklist, so 3D games get `webgl` instead of a canvas fallback.
 */
export const CHROMIUM_ARGS: readonly string[] = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
