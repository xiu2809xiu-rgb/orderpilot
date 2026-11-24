/** The most blocks the shader draws: the desk's seven, with room for one more. */
export const MAX_BLOCKS = 8;

// The hash chain as glass blocks in a row, seen from the front and a little
// above (F-10, direction A). One unit is one slot of the picture, and the camera
// is orthographic, so block i sits exactly in slot i and the HTML numbers under
// the canvas line up without any projection: chainModel.slotCentre is the same
// sum. The blocks are rounded boxes found by ray marching; only the slot under
// a ray and its neighbours are tested, so a wider chain costs no more per pixel.
// States: 0 not known, 1 verified, 2 where the chain breaks. The output is
// premultiplied and transparent around the blocks, so the card shows through.
export const CHAIN_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uSlots;
uniform float uCount;
uniform float uState[${String(MAX_BLOCKS)}];
uniform float uEarlier;
uniform float uTravel;
uniform float uSettle;
uniform vec3 uAccent;
uniform vec3 uBad;
uniform vec3 uInk;
uniform vec3 uGround;
out vec4 outColor;

const vec3 B = vec3(0.30, 0.19, 0.19);
const float R = 0.07;
const float LINK = 0.028;
const float TILT = 0.32;

float stateAt(int i) { return uState[clamp(i, 0, ${String(MAX_BLOCKS - 1)})]; }
float centreOf(float i) { return i + 0.5 - uCount * 0.5; }

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// A thin rod along x from x0 to x1, at height y.
float sdRod(vec3 p, float x0, float x1, float y) {
  return length(p - vec3(clamp(p.x, x0, x1), y, 0.0)) - LINK;
}

mat2 turn(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

// The block where the chain breaks sits a little up and away, turned.
vec3 inBlock(vec3 p, float i, float state) {
  vec3 q = p - vec3(centreOf(i), 0.0, 0.0);
  if (state > 1.5) {
    q -= vec3(0.07, 0.07, 0.0);
    q.xy = turn(0.16) * q.xy;
  }
  return q;
}

// Distance to the nearest block or link, and what it is: i for block i,
// 20 + i for the link from block i to the next.
vec2 scene(vec3 p) {
  vec2 best = vec2(1e5, -1.0);
  float last = uCount - 1.0;
  float k = clamp(floor(p.x + uCount * 0.5), 0.0, last);
  for (int j = -1; j <= 1; j++) {
    float i = k + float(j);
    if (i < 0.0 || i > last) continue;
    float d = sdRoundBox(inBlock(p, i, stateAt(int(i))), B, R);
    if (d < best.x) best = vec2(d, i);
    if (i < last) {
      float x0 = centreOf(i) + B.x;
      float x1 = centreOf(i + 1.0) - B.x;
      float link;
      if (stateAt(int(i) + 1) > 1.5) {
        // Snapped: two stubs with a gap between them, the far one lifted.
        float mid = 0.5 * (x0 + x1);
        link = min(sdRod(p, x0, mid - 0.08, 0.0), sdRod(p, mid + 0.08, x1 + 0.07, 0.05));
      } else {
        link = sdRod(p, x0, x1, 0.0);
      }
      if (link < best.x) best = vec2(link, 20.0 + i);
    }
  }
  return best;
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * scene(p + e.xyy).x + e.yyx * scene(p + e.yyx).x +
    e.yxy * scene(p + e.yxy).x + e.xxx * scene(p + e.xxx).x);
}

// How far the settle after a check has lit block i: left to right.
float litOf(float i) {
  if (stateAt(int(i)) < 0.5) return 0.0;
  float span = 1.0 / max(uCount, 1.0);
  return smoothstep(i * span, (i + 1.0) * span, uSettle);
}

// The oldest block, and its link, fade when there are more events before it.
float fadeOf(float i) { return (uEarlier > 0.5 && i < 0.5) ? 0.42 : 1.0; }

vec4 shadeBlock(vec3 n, vec3 rd, float i) {
  float broken = step(1.5, stateAt(int(i)));
  float lit = litOf(i);
  vec3 tint = mix(uAccent, uBad, broken);
  vec3 glass = mix(uGround, uInk, 0.06);
  vec3 body = mix(glass, mix(uGround, tint, mix(0.32, 0.55, broken)), lit);
  vec3 light = normalize(vec3(-0.35, 0.8, 0.55));
  // A pale theme needs more light, or white glass comes out grey.
  float pale = step(0.5, dot(uGround, vec3(0.299, 0.587, 0.114)));
  float ambient = mix(0.6, 0.86, pale);
  float diffuse = ambient + (1.0 - ambient) * max(dot(n, light), 0.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float shine = pow(max(dot(reflect(rd, n), light), 0.0), 36.0);
  vec3 col = body * diffuse + mix(uInk, tint, lit) * rim * 0.55 + shine * 0.4;
  col += tint * lit * 0.08;
  return vec4(col, fadeOf(i));
}

vec4 shadeLink(float i) {
  float snapped = step(1.5, stateAt(int(i) + 1));
  float lit = min(litOf(i), litOf(i + 1.0));
  vec3 quiet = mix(uGround, uInk, 0.28);
  vec3 col = mix(mix(quiet, uAccent, lit), uBad, snapped);
  return vec4(col, fadeOf(i) * mix(mix(0.6, 0.95, lit), 0.95, snapped));
}

void main() {
  if (uCount < 0.5) {
    outColor = vec4(0.0);
    return;
  }
  float px = uSlots / uResolution.x;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) * px;
  vec3 rd = vec3(0.0, -sin(TILT), -cos(TILT));
  vec3 up = vec3(0.0, cos(TILT), -sin(TILT));
  vec3 ro = vec3(p.x, 0.0, 0.0) + up * p.y - rd * 4.0;

  float t = 0.0;
  float closest = 1e5;
  float closestAt = 0.0;
  for (int s = 0; s < 72; s++) {
    float d = scene(ro + rd * t).x;
    if (d < closest) {
      closest = d;
      closestAt = t;
    }
    if (d < 0.0004 || t > 8.0) break;
    t += d;
  }

  // Behind the blocks: a soft shadow under each, and a glow round the lit
  // ones and the break. Premultiplied throughout.
  vec4 back = vec4(0.0);
  for (int i = 0; i < ${String(MAX_BLOCKS)}; i++) {
    float fi = float(i);
    if (fi > uCount - 0.5) break;
    float state = stateAt(i);
    float lift = state > 1.5 ? 0.07 * cos(TILT) : 0.0;
    vec2 at = vec2(centreOf(fi) + (state > 1.5 ? 0.07 : 0.0), lift);
    vec2 under = (p - vec2(centreOf(fi), -0.24)) / vec2(0.36, 0.05);
    float shadow = exp(-dot(under, under)) * 0.14 * fadeOf(fi);
    back += vec4(0.0, 0.0, 0.0, shadow) * (1.0 - back.a);
    float glow = max(exp(-length((p - at) * vec2(1.0, 1.7)) * 4.5) - 0.015, 0.0);
    float strength = state > 1.5 ? 0.38 : 0.2 * litOf(fi);
    vec3 tint = state > 1.5 ? uBad : uAccent;
    float g = glow * strength * fadeOf(fi);
    back += vec4(tint * g, g) * (1.0 - back.a);
  }

  // A glow's tail never quite reaches nothing: fade it out before the canvas
  // ends, or the canvas shows as a faint band on the card.
  vec2 uv = gl_FragCoord.xy / uResolution;
  back *= smoothstep(0.0, 0.2, min(uv.y, 1.0 - uv.y)) *
    smoothstep(0.0, 0.04, min(uv.x, 1.0 - uv.x));

  // The nearest surface, with soft edges: a ray that just misses still
  // covers part of its pixel.
  vec4 front = vec4(0.0);
  float cover = clamp(1.0 - closest / (px * 1.2), 0.0, 1.0);
  if (cover > 0.0) {
    vec3 q = ro + rd * (closest < 0.0004 ? t : closestAt);
    float what = scene(q).y;
    vec4 c = what > 19.5
      ? shadeLink(what - 20.0)
      : shadeBlock(normalAt(q), rd, what);
    float a = c.a * cover;
    front = vec4(c.rgb * a, a);
  }

  // While a check runs, a light travels along the chain, oldest to newest.
  if (uTravel > 0.5) {
    float from = centreOf(0.0) - 0.5;
    float to = centreOf(uCount - 1.0) + 0.5;
    vec2 bead = vec2(mix(from, to, fract(uTime * 0.45)), 0.0);
    float d = length(p - bead);
    float core = smoothstep(0.06, 0.03, d);
    float halo = exp(-d * 9.0) * 0.7;
    vec4 shine = vec4(vec3(1.0) * core + uAccent * halo, max(core, halo));
    front = shine + front * (1.0 - shine.a);
  }

  outColor = front + back * (1.0 - front.a);
}`;
