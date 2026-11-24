export const HUD_CSS = `
.rr3d-hud {
  position: absolute;
  inset: 0;
  z-index: 5;
  color: #fff7e5;
  pointer-events: none;
  font: 600 16px/1.2 system-ui, sans-serif;
}
.rr3d-hud [hidden] { display: none; }
.rr3d-race-info, .rr3d-dash, .rr3d-race-hint, .rr3d-results {
  background: #231d17f5;
  border: 1px solid #f7dcad5c;
  box-shadow: 0 3px 10px #19130f44;
}
.rr3d-race-info {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top));
  left: calc(16px + env(safe-area-inset-left));
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 23px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.rr3d-place { min-width: 2.4ch; color: #ffda8f; }
.rr3d-progress { width: clamp(66px, 20vw, 180px); padding-inline: 5px; }
.rr3d-lane {
  position: relative;
  height: 9px;
  background: linear-gradient(#a68d6b, #a68d6b) center / 100% 1px no-repeat;
  border-inline: 1px solid #a68d6b;
}
.rr3d-marker {
  position: absolute;
  top: 1px;
  width: 7px;
  height: 7px;
  border: 1px solid #fff6df;
  box-sizing: border-box;
  border-radius: 50%;
  transform: translateX(-50%);
}
.rr3d-marker[data-player] {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  border-color: #ffda8f;
  background: #fff6df;
  transform: translateX(-50%) rotate(45deg);
}
.rr3d-dash {
  position: absolute;
  left: calc(16px + env(safe-area-inset-left));
  bottom: calc(18px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
}
.arcade-container:has(.arcade-touch) .rr3d-dash {
  left: calc(164px + env(safe-area-inset-left));
  bottom: calc(32px + env(safe-area-inset-bottom));
}
.rr3d-dash i {
  width: 15px;
  height: 12px;
  border: 1px solid #d8b478;
  border-radius: 2px;
  transform: skewX(-14deg);
}
.rr3d-dash i[data-charged] { background: #ffce73; }
.rr3d-race-hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - 240px);
  margin: 0;
  padding: 7px 10px;
  border-radius: 8px;
  text-align: center;
}
.rr3d-touch-keys,
.arcade-container:has(.arcade-touch) .rr3d-keyboard-keys { display: none; }
.arcade-container:has(.arcade-touch) .rr3d-touch-keys { display: inline; }
.arcade-container:has(.arcade-touch) .rr3d-race-hint {
  left: calc(50% + (env(safe-area-inset-left) - env(safe-area-inset-right)) / 2);
  max-width: calc(100% - 550px - env(safe-area-inset-left) - env(safe-area-inset-right));
}
.rr3d-count {
  position: absolute;
  top: 37.5%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff1c7;
  font-size: clamp(68px, 18vmin, 116px);
  font-weight: 950;
  line-height: 1;
  paint-order: stroke fill;
  -webkit-text-stroke: 5px #35251a;
  text-shadow: 0 6px 10px #2a201d99;
}
.rr3d-results {
  position: absolute;
  top: 46%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  width: min(350px, calc(100% - 32px));
  padding: clamp(12px, 2.5vw, 20px);
  border-radius: 12px;
}
.rr3d-results h2 { margin: 0 0 10px; color: #ffe1a0; font-size: 25px; }
.rr3d-results p { margin: 4px 0 0; }
.rr3d-results ol {
  display: grid;
  gap: 3px;
  list-style: none;
  padding: 0;
  margin: 0 0 10px;
  font-variant-numeric: tabular-nums;
}
.rr3d-results li {
  display: grid;
  grid-template-columns: 2.4em 1fr auto;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #ffffff0c;
}
.rr3d-results li[data-player] { background: #72532e; }
.rr3d-results .rr3d-best { color: #ffda8f; }
.rr3d-results .rr3d-badge { margin-left: 8px; font-weight: 850; }
.arcade-container:has(.rr3d-results:not([hidden])) .arcade-touch :is(.dpad, button[data-action="jump"]) {
  visibility: hidden;
}
@media (max-width: 760px) {
  .rr3d-race-info { font-size: 21px; }
  .rr3d-progress { width: clamp(52px, 12vw, 90px); }
  .arcade-container:has(.arcade-touch) .rr3d-race-hint {
    max-width: calc(100% - 380px - env(safe-area-inset-left) - env(safe-area-inset-right));
  }
  .arcade-container:has(.arcade-touch) .rr3d-dash {
    top: calc(72px + env(safe-area-inset-top));
    left: calc(16px + env(safe-area-inset-left));
    bottom: auto;
  }
  .arcade-container:has(.arcade-touch) .rr3d-results {
    left: calc(16px + env(safe-area-inset-left));
    right: calc(132px + env(safe-area-inset-right));
    width: auto;
    max-width: 350px;
    margin-inline: auto;
    transform: translateY(-50%);
  }
  .arcade-container:has(.rr3d-results:not([hidden])) .arcade-touch button[data-action="dash"] {
    right: 0 !important;
    bottom: 0 !important;
  }
}
`;
