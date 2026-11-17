import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindLoopMotion} from '../src/components/loopMotion.mjs';

function setup(t) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const stage = new EventTarget();
  stage.clientWidth = 400;
  const canvas = new EventTarget();
  canvas.parentElement = stage;
  canvas.classList = new Set();
  canvas.classList.remove = canvas.classList.delete;
  for (const surface of [stage, canvas]) {
    surface.setPointerCapture = () => {};
    surface.hasPointerCapture = () => false;
  }
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => { globalThis.window = previousWindow; });
  const loop = {rotation: {x: 0, y: 0}};
  let frame;
  const motion = bindLoopMotion(canvas, {
    runRenderLoop: callback => { frame = callback; },
    stopRenderLoop: () => { frame = undefined; },
  }, {render() {}}, loop);
  t.after(() => motion.dispose());
  function pointer(type, x, y = 100, target = stage) {
    const event = new Event(type, {cancelable: true});
    Object.assign(event, {pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y});
    Object.defineProperty(event, 'timeStamp', {value: now});
    target.dispatchEvent(event);
    return event;
  }
  return {loop, canvas, motion, pointer,
    advance(ms) { now += ms; frame?.(); }};
}

test('the artwork area captures vertical drags outside the canvas and keeps momentum', t => {
  const {loop, canvas, motion, pointer, advance} = setup(t);
  motion.play();
  advance(0);
  pointer('pointerdown', 100);
  assert.ok(canvas.classList.has('is-dragging'));
  advance(20);
  pointer('pointermove', 80, 80);
  assert.ok(loop.rotation.y > 0 && loop.rotation.x > 0);
  pointer('pointerup', 80, 80);
  assert.ok(!canvas.classList.has('is-dragging'));
  const released = loop.rotation.y;
  advance(1000);
  const afterOneSecond = loop.rotation.y;
  advance(200);
  // Still moving substantially faster than the idle turntable after one second.
  assert.ok(loop.rotation.y - afterOneSecond > 0.08);
  assert.ok(afterOneSecond > released);
});

test('holding before release, cancellation, and pause discard stale momentum', t => {
  const {loop, canvas, motion, pointer, advance} = setup(t);
  motion.play();
  advance(0);
  for (const finish of ['held', 'pointercancel', 'lostpointercapture', 'pause']) {
    pointer('pointerdown', 100);
    advance(20);
    pointer('pointermove', 80);
    assert.ok(canvas.classList.has('is-dragging'));
    assert.ok(loop.rotation.y > 0);
    if (finish === 'held') {
      advance(1000);
      pointer('pointerup', 80);
    } else if (finish === 'pause') motion.pause();
    else pointer(finish, 80);
    assert.ok(!canvas.classList.has('is-dragging'));
    const released = loop.rotation.y;
    advance(200);
    assert.ok(loop.rotation.y - released < 0.03, finish);
  }
});
