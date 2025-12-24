/**
 * Device Fingerprinting for Anti-Fraud
 * Generates a unique fingerprint based on browser/device characteristics
 */

interface FingerprintData {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  timezone: string;
  timezoneOffset: number;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  canvas?: string;
  webgl?: string;
}

/**
 * Generate a simple hash from a string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ChatASN Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('ChatASN Fingerprint', 4, 17);
    
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

/**
 * Get WebGL fingerprint
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    return `${vendor}~${renderer}`;
  } catch {
    return '';
  }
}

/**
 * Collect all fingerprint data
 */
function collectFingerprintData(): FingerprintData {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: Array.from(navigator.languages || []),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
  };
}

/**
 * Generate device fingerprint
 * Returns a unique hash based on device/browser characteristics
 */
export function generateFingerprint(): string {
  const data = collectFingerprintData();
  
  // Create a stable string representation
  const fingerprintString = [
    data.userAgent,
    data.platform,
    data.language,
    data.languages.join(','),
    data.timezone,
    data.timezoneOffset,
    data.screenWidth,
    data.screenHeight,
    data.colorDepth,
    data.pixelRatio,
    data.hardwareConcurrency,
    data.maxTouchPoints,
    data.cookieEnabled,
    data.doNotTrack,
    simpleHash(data.canvas || ''),
    simpleHash(data.webgl || ''),
  ].join('|');
  
  // Generate final hash
  return simpleHash(fingerprintString);
}
