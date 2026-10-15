const ua = navigator.userAgent;
const platform = navigator.userAgentData?.platform || navigator.platform || '';

export const isApple = /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X|iPhone|iPad/.test(ua);
// iPadOS reports a Mac platform; touch points give it away.
export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1);
export const desktopOS = isMobile ? null : /win/i.test(platform) || /Windows/.test(ua) ? 'windows' : isApple ? 'macos' : null;
export const MOD = isApple ? 'Cmd' : 'Ctrl';
export const isMod = e => (isApple ? e.metaKey : e.ctrlKey);
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
