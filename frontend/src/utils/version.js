/**
 * Application version information
 * This will be replaced during build time
 */

// This will be set by the build process or environment
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.1';
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'fix-invalid-date-nan';

/**
 * Log version information to console
 */
export function logVersion() {
  console.log(`%c🏀 SHFantasy`, 'font-size: 16px; font-weight: bold; color: #00ffff;');
  console.log(`Version: ${APP_VERSION}`);
  console.log(`Build ID: ${BUILD_ID}`);
}

/**
 * Get version string for display
 */
export function getVersionString() {
  return `v${APP_VERSION} (${BUILD_ID})`;
}
