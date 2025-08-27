// Version file to force cache invalidation - UPDATED FOR CACHE BUST
export const APP_VERSION = '1.1.2';
export const BUILD_TIMESTAMP = '2025-08-27T09:05:00.000Z';
export const CACHE_BUSTER = Math.random() * 1000000;
export const FORCE_REBUILD = true;

// Additional cache busting data
export const BUILD_CONFIG = {
  buildId: 'cache-bust-v2',
  dependencies: ['uuid', 'axios', 'react'],
  timestamp: Date.now(),
  random: Math.floor(Math.random() * 999999),
};

console.log(`📦 SetuKReview v${APP_VERSION} - Built at ${BUILD_TIMESTAMP}`);
console.log(`🔥 Force rebuild: ${FORCE_REBUILD} - Cache buster: ${CACHE_BUSTER}`);
console.log(`⚙️ Build config:`, BUILD_CONFIG);