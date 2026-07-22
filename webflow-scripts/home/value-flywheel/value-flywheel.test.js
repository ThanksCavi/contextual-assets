const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const script = readFileSync(join(__dirname, 'value-flywheel.js'), 'utf8');
const styles = readFileSync(join(__dirname, 'value-flywheel.css'), 'utf8');

function readTiming() {
  const match = script.match(/const TIMING = (\{[\s\S]*?\n  \});/);

  assert.ok(match, 'Expected the value-flywheel TIMING object');
  return Function(`"use strict"; return (${match[1]});`)();
}

test('keeps branch-arrow opacity under GSAP control', () => {
  assert.doesNotMatch(
    styles,
    /\.is-sa-ready \.sa-arrow-top,[\s\S]{0,400}transition:\s*opacity/
  );
  assert.doesNotMatch(
    styles,
    /\.is-sa-transition \.sa-arrow-top,[\s\S]{0,400}opacity:\s*0/
  );
});

test('reveals each arrowhead only after its line draw completes', () => {
  const timing = readTiming();

  assert.ok(timing.introArrow, 'Expected intro-arrow timing to be explicit');
  assert.ok(
    timing.introArrow.arrowheadStart >= timing.introArrow.lineDuration,
    'Intro arrowhead starts before its line finishes'
  );
  assert.ok(
    timing.branchDraw.arrowheadStart >= timing.branchDraw.start + timing.branchDraw.duration,
    'Branch arrowheads start before their lines finish'
  );
  assert.ok(
    timing.finalArrow.arrowheadStart >= timing.finalArrow.start + timing.finalArrow.duration,
    'Final arrowhead starts before its lines finish'
  );
});
