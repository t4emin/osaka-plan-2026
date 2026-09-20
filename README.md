# osaka-plan-2026

Static trip guide: open `index.html` or serve this directory with any static server.

The companion lives in `mascot.js` and `mascot.css`, using the existing sprite
and small SVG props. Tap to cycle through greetings, takoyaki, a day-specific
action, a map, and a spin; tap twice quickly to spin. Scrolling and opening details trigger reactions, and the companion
falls asleep after a quiet period. Reduced motion and hidden tabs pause movement.

Scrolling upward brings back the red balloon: four aligned sprite frames move
the free arm and alternate the feet while the torso stays upright. The balloon
stays visible during the gentle landing. The original balloon artwork is kept
alongside the new `assets/mascot-balloon-active.webp` animation sheet.

Run mascot behavior checks with `node --test tests/mascot.test.cjs`.
