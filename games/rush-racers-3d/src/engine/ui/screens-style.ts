export const SCREENS_CSS = `
.rr3d-menus {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  color: #fff6de;
  font: 600 16px/1.25 system-ui, sans-serif;
}
.rr3d-menus [hidden] { display: none; }
.arcade-container:has(.rr3d-title:not([hidden])) .arcade-touch :is(.dpad, button:not([data-action="fire"])),
.arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch .actions button:not([data-action="fire"], [data-action="dash"]) {
  visibility: hidden;
}
.rr3d-title, .rr3d-select { position: absolute; inset: 0; }
.rr3d-title {
  display: grid;
  align-items: center;
  background: linear-gradient(90deg, #102f2bf0, #15382edb 29%, #17382d75 46%, transparent 69%);
}
.rr3d-title-copy {
  margin-left: calc(clamp(16px, 6vw, 100px) + env(safe-area-inset-left));
  padding-bottom: 3vh;
}
.rr3d-title h1 {
  position: relative;
  width: max-content;
  margin: 0;
  color: #fff4cc;
  font: italic 900 clamp(48px, 8.4vw, 132px)/0.82 Georgia, serif;
  letter-spacing: -0.065em;
  text-transform: uppercase;
  text-shadow: 1px 3px #8f542d, 2px 6px #392e1e;
}
.rr3d-title h1 span { display: block; margin-left: 0.14em; }
.rr3d-title h1 sup {
  position: absolute;
  right: 0.12em;
  top: 0.06em;
  border-block: 0.09em solid currentColor;
  padding: 0.13em 0.08em;
  color: #ffd176;
  font: italic 900 0.34em/1 system-ui, sans-serif;
  letter-spacing: -0.055em;
}
.rr3d-title p {
  display: inline-block;
  margin: 26px 0 0 0.8em;
  padding: 9px 16px;
  color: #fff9e4;
  border-left: 5px solid #edb858;
  background: #163d34;
  box-shadow: 0 2px #102920;
}
.rr3d-select {
  display: grid;
  align-items: center;
  background: linear-gradient(90deg, #132e27fa 8%, #15382fed 38%, #16382b00 72%);
}
.rr3d-select-copy {
  margin-left: calc(clamp(14px, 3.8vw, 58px) + env(safe-area-inset-left));
  width: min(48vw, 570px);
}
.rr3d-select h2 {
  margin: 0 0 12px;
  color: #ffe1a0;
  font-size: clamp(22px, 3.6vw, 42px);
  font-family: Georgia, serif;
  font-style: italic;
  font-weight: 850;
  letter-spacing: -0.04em;
}
.rr3d-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rr3d-cards li {
  position: relative;
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 8px;
  border: 2px solid #69765c;
  border-radius: 2px 9px 2px 2px;
  background: #1c382e;
}
.rr3d-cards li[aria-current="true"] {
  border-color: #ffe1a0;
  background: #395642;
  box-shadow: inset 0 -3px #f0bf67;
}
.rr3d-cards li[aria-current="true"]::after {
  position: absolute;
  top: 8px;
  right: 8px;
  content: '◆';
  color: #ffe1a0;
  font-size: 13px;
}
.rr3d-card-color {
  width: 23px;
  height: 7px;
  margin-bottom: 2px;
  border: 1px solid #fff6de90;
  border-radius: 2px;
}
.rr3d-card-name { font-size: clamp(16px, 2.1vw, 23px); font-weight: 800; line-height: 1; }
.rr3d-card-species { color: #f1dfc3; font-size: 16px; font-weight: 500; line-height: 1.1; }
.rr3d-select-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
  margin: 10px 0 0;
  text-shadow: 0 1px #231d17;
}
@media (max-height: 430px) {
  .rr3d-title-copy { margin: 12px 0 0 calc(9vw + env(safe-area-inset-left)); }
  .rr3d-title h1 { font-size: clamp(34px, min(8vw, 19vh), 70px); }
  .rr3d-title p { margin-top: 14px; }
  .rr3d-select { align-items: start; }
  .rr3d-select-copy {
    /* Keep menu text above the controls and leave room for the shell's back link. */
    display: grid;
    grid-template:
      'heading hint' auto
      'cards cards' auto
      / max-content minmax(0, 1fr);
    align-items: center;
    gap: 4px clamp(12px, 3.5vw, 36px);
    margin-top: calc(8px + env(safe-area-inset-top));
    margin-right: calc(80px + env(safe-area-inset-right));
    width: auto;
  }
  .rr3d-select h2 { grid-area: heading; margin: 0; font-size: 22px; }
  .rr3d-select-hint { grid-area: hint; max-width: 270px; margin: 0; font-size: 14px; line-height: 1.15; }
  .rr3d-cards {
    grid-area: cards;
    gap: 4px;
    width: min(100%, clamp(360px, 53vw, 570px));
  }
  .rr3d-cards li {
    grid-template-columns: 9px minmax(0, 1fr);
    gap: 0 5px;
    padding: 1px 5px;
    border-width: 1px;
  }
  .rr3d-cards li[aria-current="true"]::after { top: 1px; right: 4px; font-size: 10px; }
  .rr3d-card-color { align-self: center; width: 7px; height: 7px; margin: 0; }
  .rr3d-card-name { font-size: 16px; }
  .rr3d-card-species { grid-column: 1 / -1; font-size: 13px; line-height: 1; }
}
@media (min-height: 350px) and (max-height: 430px) {
  .rr3d-select-copy { margin-top: calc(12px + env(safe-area-inset-top)); }
  .rr3d-select h2 { font-size: 26px; }
  .rr3d-cards li { padding-block: 3px; }
  .rr3d-card-species { font-size: 14px; }
}
@media (max-width: 700px) and (max-height: 430px) {
  .rr3d-card-species { font-size: 13px; }
}
`;
