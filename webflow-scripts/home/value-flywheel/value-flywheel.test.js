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

test('keeps dash-animation geometry in the SVG coordinate system', () => {
  assert.doesNotMatch(
    styles,
    /\[data-sa-line\][\s\S]{0,200}vector-effect:\s*non-scaling-stroke/
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

test('fades branch arrows as the moving cards begin to cover them', () => {
  const timing = readTiming();
  const arrowheadEnd = timing.branchDraw.arrowheadStart + timing.branchDraw.arrowheadDuration;
  const fadeEnd = timing.branchFade.start + timing.branchFade.duration;
  const overlapStart = timing.blueCardsExit.start + 0.02;
  const fullOverlap = timing.blueCardsExit.start + 0.12;
  const epsilon = 1e-9;

  assert.ok(
    Math.abs(timing.branchFade.start - arrowheadEnd) < epsilon,
    'Branch fade should begin as soon as the arrowhead reveal finishes'
  );
  assert.ok(
    timing.branchFade.start <= overlapStart + epsilon,
    'Branch fade starts after the moving cards begin to cover the arrows'
  );
  assert.ok(
    fadeEnd <= fullOverlap + epsilon,
    'Branch arrows remain visible after the moving cards cover them'
  );
});
