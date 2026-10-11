/**
 * Vaibhav Geometer — Portfolio Scripts & Interactive 3D Geometry Engine
 * Pure Vanilla JavaScript with Canvas 3D Parametric Surface Rendering
 */

(function() {
  'use strict';

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon(next);
  };

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
      btn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    }
  }

  // --- 3D Geometry Engine ---
  const GeometryEngine = {
    surfaces: {
      mobius: {
        name: "Möbius Strip",
        equation: "$$\\vec{r}(u, v) = \\left( \\left[1 + \\frac{v}{2}\\cos\\frac{u}{2}\\right]\\cos u, \\; \\left[1 + \\frac{v}{2}\\cos\\frac{u}{2}\\right]\\sin u, \\; \\frac{v}{2}\\sin\\frac{u}{2} \\right), \\quad u \\in [0, 2\\pi], v \\in [-1, 1]$$",
        generate: function(uSteps, vSteps, factor) {
          const points = [];
          const lines = [];
          const uCount = uSteps || 36;
          const vCount = vSteps || 8;
          const scale = 2.4 * (factor || 1.0);

          for (let i = 0; i <= uCount; i++) {
            const u = (i / uCount) * Math.PI * 2;
            for (let j = 0; j <= vCount; j++) {
              const v = ((j / vCount) * 2 - 1) * 0.45;
              const x = (1 + (v / 2) * Math.cos(u / 2)) * Math.cos(u) * scale;
              const y = (1 + (v / 2) * Math.cos(u / 2)) * Math.sin(u) * scale;
              const z = (v / 2) * Math.sin(u / 2) * scale * 1.5;
              points.push({ x, y, z });

              const curr = i * (vCount + 1) + j;
              if (j > 0) lines.push([curr - 1, curr]);
              if (i > 0) {
                const prev = (i - 1) * (vCount + 1) + j;
                lines.push([prev, curr]);
              }
            }
          }
          return { points, lines };
        }
      },

      torus_knot: {
        name: "Torus Knot (3, 7)",
        equation: "$$\\vec{r}(t) = \\begin{pmatrix} (R + r\\cos qt)\\cos pt \\\\ (R + r\\cos qt)\\sin pt \\\\ -r\\sin qt \\end{pmatrix}, \\quad p=3, \\; q=7, \\; t \\in [0, 2\\pi]$$",
        generate: function(uSteps, vSteps, factor) {
          const points = [];
          const lines = [];
          const p = 3;
          const q = 7;
          const R = 2.0 * (factor || 1.0);
          const r = 0.65 * (factor || 1.0);
          const totalPoints = 260;

          for (let i = 0; i <= totalPoints; i++) {
            const t = (i / totalPoints) * Math.PI * 2;
            const rCur = R + Math.cos(q * t) * r;
            const x = rCur * Math.cos(p * t);
            const y = rCur * Math.sin(p * t);
            const z = -Math.sin(q * t) * 1.5;
            points.push({ x, y, z });
            if (i > 0) lines.push([i - 1, i]);
          }

          // Cross rings
          const ringCount = 28;
          for (let k = 0; k < ringCount; k++) {
            const idx = Math.floor((k / ringCount) * totalPoints);
            const pCenter = points[idx];
            const nextIdx = (idx + 4) % totalPoints;
            const dir = {
              x: points[nextIdx].x - pCenter.x,
              y: points[nextIdx].y - pCenter.y,
              z: points[nextIdx].z - pCenter.z
            };
            const baseIdx = points.length;
            const ringPts = 8;
            for (let rIdx = 0; rIdx < ringPts; rIdx++) {
              const theta = (rIdx / ringPts) * Math.PI * 2;
              points.push({
                x: pCenter.x + Math.cos(theta) * 0.28,
                y: pCenter.y + Math.sin(theta) * 0.28,
                z: pCenter.z + Math.sin(theta) * 0.15
              });
              if (rIdx > 0) lines.push([baseIdx + rIdx - 1, baseIdx + rIdx]);
            }
            lines.push([baseIdx + ringPts - 1, baseIdx]);
          }

          return { points, lines };
        }
      },

      enneper: {
        name: "Enneper's Minimal Surface (H = 0)",
        equation: "$$\\vec{r}(u, v) = \\left( u - \\frac{u^3}{3} + uv^2, \\; v - \\frac{v^3}{3} + vu^2, \\; u^2 - v^2 \\right), \\quad u, v \\in [-1.5, 1.5]$$",
        generate: function(uSteps, vSteps, factor) {
          const points = [];
          const lines = [];
          const count = 20;
          const range = 1.35;
          const scale = 0.95 * (factor || 1.0);

          for (let i = 0; i <= count; i++) {
            const u = -range + (i / count) * (2 * range);
            for (let j = 0; j <= count; j++) {
              const v = -range + (j / count) * (2 * range);
              const x = (u - (u*u*u)/3 + u*v*v) * scale;
              const y = (v - (v*v*v)/3 + v*u*u) * scale;
              const z = (u*u - v*v) * scale;
              points.push({ x, y, z });

              const curr = i * (count + 1) + j;
              if (j > 0) lines.push([curr - 1, curr]);
              if (i > 0) {
                const prev = (i - 1) * (count + 1) + j;
                lines.push([prev, curr]);
              }
            }
          }
          return { points, lines };
        }
      },

      hyperbolic_paraboloid: {
        name: "Hyperbolic Paraboloid (Saddle Surface)",
        equation: "$$z = \\frac{x^2}{a^2} - \\frac{y^2}{b^2}, \\quad K = -\\frac{4a^2 b^2}{(4a^4 y^2 + 4b^4 x^2 + a^4 b^4)^{3/2}} < 0$$",
        generate: function(uSteps, vSteps, factor) {
          const points = [];
          const lines = [];
          const count = 18;
          const range = 1.8;
          const scale = 1.2 * (factor || 1.0);

          for (let i = 0; i <= count; i++) {
            const u = -range + (i / count) * (2 * range);
            for (let j = 0; j <= count; j++) {
              const v = -range + (j / count) * (2 * range);
              const x = u * scale;
              const y = v * scale;
              const z = ((u * u) / 2.2 - (v * v) / 2.2) * scale;
              points.push({ x, y, z });

              const curr = i * (count + 1) + j;
              if (j > 0) lines.push([curr - 1, curr]);
              if (i > 0) {
                const prev = (i - 1) * (count + 1) + j;
                lines.push([prev, curr]);
              }
            }
          }
          return { points, lines };
        }
      },

      clifford_torus: {
        name: "Clifford Torus in 3D Projection",
        equation: "$$\\vec{r}(u, v) = \\frac{1}{\\sqrt{2}}\\left( \\cos u, \\sin u, \\cos v, \\sin v \\right) \\in \\mathbb{S}^3 \\subset \\mathbb{R}^4 \\xrightarrow{\\text{stereo}} \\mathbb{R}^3$$",
        generate: function(uSteps, vSteps, factor) {
          const points = [];
          const lines = [];
          const countU = 24;
          const countV = 16;
          const scale = 2.0 * (factor || 1.0);

          for (let i = 0; i <= countU; i++) {
            const u = (i / countU) * Math.PI * 2;
            for (let j = 0; j <= countV; j++) {
              const v = (j / countV) * Math.PI * 2;
              // Stereographic projection of flat torus from 4D
              const x4 = Math.cos(u) * 0.7071;
              const y4 = Math.sin(u) * 0.7071;
              const z4 = Math.cos(v) * 0.7071;
              const w4 = Math.sin(v) * 0.7071;
              const denom = 1.5 - w4;

              const x = (x4 / denom) * scale;
              const y = (y4 / denom) * scale;
              const z = (z4 / denom) * scale;
              points.push({ x, y, z });

              const curr = i * (countV + 1) + j;
              if (j > 0) lines.push([curr - 1, curr]);
              if (i > 0) {
                const prev = (i - 1) * (countV + 1) + j;
                lines.push([prev, curr]);
              }
            }
          }
          return { points, lines };
        }
      }
    },

    createRenderer: function(canvasId, initialSurfaceKey, options) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      const opts = Object.assign({
        autoRotate: true,
        rotSpeedX: 0.003,
        rotSpeedY: 0.006,
        curvatureFactor: 1.0,
        interactive: true,
        colorTheme: 'cyan'
      }, options);

      let activeKey = initialSurfaceKey || 'mobius';
      let surfaceData = null;
      let rotX = 0.5;
      let rotY = 0.6;
      let isDragging = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      let animId = null;

      function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }
      resize();
      window.addEventListener('resize', resize);

      function rebuild() {
        const gen = GeometryEngine.surfaces[activeKey];
        if (gen) {
          surfaceData = gen.generate(28, 16, opts.curvatureFactor);
        }
      }
      rebuild();

      if (opts.interactive) {
        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - lastMouseX;
          const dy = e.clientY - lastMouseY;
          rotY += dx * 0.008;
          rotX += dy * 0.008;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => { isDragging = false; });

        canvas.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
          }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (!isDragging || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - lastMouseX;
          const dy = e.touches[0].clientY - lastMouseY;
          rotY += dx * 0.008;
          rotX += dy * 0.008;
          lastMouseX = e.touches[0].clientX;
          lastMouseY = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchend', () => { isDragging = false; });
      }

      function render() {
        if (!canvas.offsetParent && canvas.offsetWidth === 0) {
          animId = requestAnimationFrame(render);
          return;
        }

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        if (opts.autoRotate && !isDragging) {
          rotX += opts.rotSpeedX;
          rotY += opts.rotSpeedY;
        }

        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);

        const cx = width / 2;
        const cy = height / 2;
        const fov = Math.min(width, height) * 0.85;

        const proj = [];
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        for (let i = 0; i < surfaceData.points.length; i++) {
          const p = surfaceData.points[i];
          // Rotate Y
          const x1 = p.x * cosY + p.z * sinY;
          const z1 = -p.x * sinY + p.z * cosY;
          // Rotate X
          const y2 = p.y * cosX - z1 * sinX;
          const z2 = p.y * sinX + z1 * cosX;

          const depth = z2 + 6.0;
          const scale = fov / Math.max(0.2, depth);
          proj.push({
            x: cx + x1 * scale,
            y: cy + y2 * scale,
            depth: depth
          });
        }

        // Draw Lines
        ctx.lineWidth = 1.1;
        const lineCount = surfaceData.lines.length;

        for (let i = 0; i < lineCount; i++) {
          const l = surfaceData.lines[i];
          const p1 = proj[l[0]];
          const p2 = proj[l[1]];
          if (!p1 || !p2) continue;

          const avgDepth = (p1.depth + p2.depth) / 2;
          const alpha = Math.max(0.12, Math.min(0.85, 1.4 - (avgDepth - 3.5) * 0.25));

          if (isDark) {
            ctx.strokeStyle = (opts.colorTheme === 'indigo') 
              ? `rgba(129, 140, 248, ${alpha})`
              : `rgba(56, 189, 248, ${alpha})`;
          } else {
            ctx.strokeStyle = (opts.colorTheme === 'indigo')
              ? `rgba(79, 70, 229, ${alpha})`
              : `rgba(2, 132, 199, ${alpha})`;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        animId = requestAnimationFrame(render);
      }

      animId = requestAnimationFrame(render);

      return {
        setSurface: function(key) {
          if (GeometryEngine.surfaces[key]) {
            activeKey = key;
            rebuild();
            const formulaBox = document.getElementById('sandbox-formula-text');
            const formulaName = document.getElementById('sandbox-surface-name');
            if (formulaName) {
              formulaName.innerText = GeometryEngine.surfaces[key].name;
            }
            if (formulaBox && GeometryEngine.surfaces[key].equation) {
              formulaBox.innerHTML = GeometryEngine.surfaces[key].equation;
              if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([formulaBox]).catch(() => {});
              }
            }
          }
        },
        setCurvature: function(factor) {
          opts.curvatureFactor = factor;
          rebuild();
        },
        setAutoRotate: function(enable) {
          opts.autoRotate = enable;
        }
      };
    }
  };

  // --- Initialize on DOM Ready ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // 1. Hero 3D Canvas
    GeometryEngine.createRenderer('hero-3d-canvas', 'torus_knot', {
      autoRotate: true,
      rotSpeedX: 0.002,
      rotSpeedY: 0.005,
      colorTheme: 'indigo'
    });

    // 2. Interactive Differential Geometry Sandbox
    const sandboxEngine = GeometryEngine.createRenderer('sandbox-canvas', 'mobius', {
      autoRotate: true,
      rotSpeedX: 0.002,
      rotSpeedY: 0.004,
      colorTheme: 'cyan'
    });

    // Sandbox Controls Wiring
    const select = document.getElementById('sandbox-surface-select');
    if (select && sandboxEngine) {
      select.addEventListener('change', (e) => {
        sandboxEngine.setSurface(e.target.value);
      });
    }

    const slider = document.getElementById('sandbox-curvature-slider');
    const sliderVal = document.getElementById('sandbox-curvature-val');
    if (slider && sandboxEngine) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (sliderVal) sliderVal.innerText = val.toFixed(1);
        sandboxEngine.setCurvature(val);
      });
    }

    const autoCheck = document.getElementById('sandbox-autorotate-check');
    if (autoCheck && sandboxEngine) {
      autoCheck.addEventListener('change', (e) => {
        sandboxEngine.setAutoRotate(e.target.checked);
      });
    }

    // Trigger MathJax typeset on load
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(() => {});
    }
  });

})();
