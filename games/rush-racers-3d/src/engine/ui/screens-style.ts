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
.rr3d-title, .rr3d-select { position: absolute; inset: 0; }
.rr3d-title {
  display: grid;
  place-items: end center;
  text-align: center;
  background: linear-gradient(180deg, #161c1690, transparent 18%, transparent 38%, #171711de 90%);
}
.rr3d-title-copy {
  margin: 0 max(16px, env(safe-area-inset-right)) max(40px, calc(18px + env(safe-area-inset-bottom)))
    max(16px, env(safe-area-inset-left));
}
.rr3d-title h1 {
  margin: 0;
  color: #ffe1a0;
  font: italic 950 clamp(36px, 8.5vw, 104px)/0.95 system-ui, sans-serif;
  letter-spacing: -0.065em;
  text-shadow: 0 4px #35241a, 0 7px 22px #170e08;
}
.rr3d-title p {
  display: inline-block;
  margin: 20px 0 0;
  padding: 8px 14px;
  border: 1px solid #f7dcad75;
  border-radius: 6px;
  background: #231d17f5;
}
.rr3d-select {
  display: grid;
  align-items: center;
  background: linear-gradient(90deg, #231d17f8 8%, #231d17e8 39%, #231d1700 73%);
}
.rr3d-select-copy {
  margin-left: calc(clamp(14px, 3.8vw, 58px) + env(safe-area-inset-left));
  width: min(48vw, 570px);
}
.rr3d-select h2 {
  margin: 0 0 12px;
  color: #ffe1a0;
  font-size: clamp(22px, 3.6vw, 42px);
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
  border: 2px solid #7e6950;
  border-radius: 7px;
  background: #32281f;
}
.rr3d-cards li[aria-current="true"] {
  border-color: #ffe1a0;
  background: #55402a;
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
  .rr3d-title-copy { margin-bottom: max(32px, calc(16px + env(safe-area-inset-bottom))); }
  .rr3d-title h1 {
    font-size: min(8.5vw, calc((100vw - 444px - env(safe-area-inset-left) - env(safe-area-inset-right)) / 7.1));
  }
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
@media (max-width: 760px) and (max-height: 430px) {
  .rr3d-title {
    place-items: start center;
    background: linear-gradient(180deg, #171711e8, transparent 60%);
  }
  .rr3d-title-copy { margin-top: calc(24px + env(safe-area-inset-top)); }
  .rr3d-title h1 { font-size: clamp(36px, 8.5vw, 104px); }
  .rr3d-title p { margin-top: 10px; }
}
`;
