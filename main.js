/**
 * Vaibhav Geometer - Main Interactive Portal Logic
 * Interactive 3D Canvas Geometry Visualizer, IIT JAM Mock Test Explorer,
 * Theme Sync, and Mathematical Interactive Tools.
 */

(function() {
  // Theme Management
  window.initTheme = function() {
    const savedTheme = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcons(savedTheme);
  };

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeToggleIcons(next);
    
    // Update canvas render colors
    if (window.updateCanvasColors) {
      window.updateCanvasColors(next);
    }
  };

  function updateThemeToggleIcons(theme) {
    const btns = document.querySelectorAll('.btn-theme-toggle');
    btns.forEach(btn => {
      btn.innerText = theme === 'dark' ? '☀' : '🌙';
      btn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    });
  }

  // Mobile Menu Drawer
  window.toggleMobileMenu = function() {
    const drawer = document.getElementById('mobile-nav-drawer');
    if (drawer) drawer.classList.toggle('open');
  };

  // Render Mock Tests on the Portal
  window.renderPortalMockTests = function() {
    const container = document.getElementById('topics-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      console.warn('MOCK_TESTS_DATA not yet loaded. Retrying...');
      setTimeout(window.renderPortalMockTests, 100);
      return;
    }

    const topics = Object.values(window.MOCK_TESTS_DATA);
    container.innerHTML = topics.map(t => {
      const bestScore = localStorage.getItem(`jam_score_${t.id}`);
      const bestScoreBadge = bestScore !== null ? 
        `<span style="font-size:0.75rem; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:3px 10px; border-radius:999px; font-weight:700;">★ Best: ${bestScore}/${t.total_marks}</span>` : '';

      return `
        <div class="topic-card" data-category="${t.category}">
          <div class="topic-card-top">
            <span class="topic-num-badge">Topic ${t.id}</span>
            <div style="display:flex; align-items:center; gap:8px;">
              ${bestScoreBadge}
              <span class="topic-category-tag">${t.category.split(' ')[0]}</span>
            </div>
          </div>

          <h3 class="topic-card-title">${t.name}</h3>

          <div class="topic-meta-grid">
            <div class="topic-meta-item">
              <span class="meta-lbl">Official Questions</span>
              <span class="meta-val">${t.total_questions} PYQs</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-lbl">Total Marks</span>
              <span class="meta-val">${t.total_marks} Marks</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-lbl">Duration</span>
              <span class="meta-val">${t.duration_minutes} Mins</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-lbl">Negative Marking</span>
              <span class="meta-val">IIT JAM Official</span>
            </div>
          </div>

          <div class="topic-actions">
            <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-start-cbt">
              <span>⚡</span> Start Official CBT Test
            </a>
            <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-practice">
              <span>📖</span> Practice Mode (Untimed)
            </a>
          </div>
        </div>
      `;
    }).join('');
  };

  // Filter Topics
  window.filterTopics = function(cat, btn) {
    document.querySelectorAll('.category-filter-tabs .cat-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cards = document.querySelectorAll('#topics-container .topic-card');
    cards.forEach(card => {
      if (cat === 'ALL' || card.dataset.category === cat) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // Filter Formula Vault by Category
  window.filterVault = function(category, btn) {
    document.querySelectorAll('.vault-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const searchInput = document.getElementById('vault-search-input');
    if (searchInput) searchInput.value = '';

    const cards = document.querySelectorAll('.vault-card');
    cards.forEach(card => {
      if (category === 'ALL' || card.dataset.category === category) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // Search Formula Vault by text query
  window.searchVault = function(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.vault-card');
    
    // Reset category tabs to All if searching
    if (q) {
      document.querySelectorAll('.vault-filter-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.includes('All'));
      });
    }

    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  };

  /* ==========================================================================
     3D Geometry Parametric Canvas Engine (Pure Vanilla Canvas + Matrix Math)
     ========================================================================== */
  const GeometryEngine = {
    surfaces: {
      torus_knot: {
        name: 'Torus Knot (3, 7)',
        equation: '$$\\vec{r}(t) = \\begin{pmatrix} (r + \\cos qt)\\cos pt \\\\ (r + \\cos qt)\\sin pt \\\\ -\\sin qt \\end{pmatrix}, \\quad p=3, q=7$$',
        generate: function(uSteps, vSteps, pFactor) {
          const points = [];
          const lines = [];
          const p = 3;
          const q = 7;
          const r = 2.0;
          const tubeR = 0.5 * (pFactor || 1);
          const totalPoints = 300;

          // Generate curve skeleton & ribbon
          for (let i = 0; i <= totalPoints; i++) {
            const t = (i / totalPoints) * Math.PI * 2;
            const rCur = r + Math.cos(q * t) * tubeR;
            const x = rCur * Math.cos(p * t);
            const y = rCur * Math.sin(p * t);
            const z = -Math.sin(q * t) * 1.5;
            points.push({ x, y, z });
            if (i > 0) lines.push([i - 1, i]);
          }

          // Generate cross rings
          const ringCount = 30;
          for (let k = 0; k < ringCount; k++) {
            const idx = Math.floor((k / ringCount) * totalPoints);
            const pCenter = points[idx];
            const nextIdx = (idx + 5) % totalPoints;
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
                x: pCenter.x + Math.cos(theta) * 0.4,
                y: pCenter.y + Math.sin(theta) * 0.4,
                z: pCenter.z + Math.sin(theta + theta) * 0.2
              });
              if (rIdx > 0) lines.push([baseIdx + rIdx - 1, baseIdx + rIdx]);
            }
            lines.push([baseIdx + ringPts - 1, baseIdx]);
          }

          return { points, lines, scale: 50 };
        }
      },

      mobius: {
        name: 'Möbius Strip (Non-Orientable Manifold)',
        equation: '$$\\vec{r}(u,v) = \\begin{pmatrix} \\left(1 + \\frac{v}{2}\\cos\\frac{u}{2}\\right)\\cos u \\\\ \\left(1 + \\frac{v}{2}\\cos\\frac{u}{2}\\right)\\sin u \\\\ \\frac{v}{2}\\sin\\frac{u}{2} \\end{pmatrix}, \\quad u \\in [0, 2\\pi], v \\in [-1, 1]$$',
        generate: function(uSteps, vSteps, pFactor) {
          const points = [];
          const lines = [];
          const nu = uSteps || 40;
          const nv = vSteps || 8;
          const twist = (pFactor || 1);

          for (let i = 0; i <= nu; i++) {
            const u = (i / nu) * Math.PI * 2;
            for (let j = 0; j <= nv; j++) {
              const v = ((j / nv) * 2 - 1) * 0.7;
              const x = (1.8 + v * Math.cos(twist * u / 2)) * Math.cos(u);
              const y = (1.8 + v * Math.cos(twist * u / 2)) * Math.sin(u);
              const z = v * Math.sin(twist * u / 2) * 1.3;
              points.push({ x, y, z });

              const cur = i * (nv + 1) + j;
              if (j > 0) lines.push([cur - 1, cur]);
              if (i > 0) lines.push([cur - (nv + 1), cur]);
            }
          }
          return { points, lines, scale: 60 };
        }
      },

      enneper: {
        name: "Enneper's Minimal Surface ($H = 0$)",
        equation: '$$\\vec{r}(u,v) = \\begin{pmatrix} u - \\frac{u^3}{3} + uv^2 \\\\ -v + \\frac{v^3}{3} - u^2v \\\\ u^2 - v^2 \\end{pmatrix}, \\quad \\text{Zero Mean Curvature}$$',
        generate: function(uSteps, vSteps, pFactor) {
          const points = [];
          const lines = [];
          const nu = uSteps || 24;
          const nv = vSteps || 24;
          const factor = (pFactor || 1) * 1.4;

          for (let i = 0; i <= nu; i++) {
            const u = ((i / nu) * 2 - 1) * factor;
            for (let j = 0; j <= nv; j++) {
              const v = ((j / nv) * 2 - 1) * factor;
              const x = u - (u * u * u) / 3 + u * v * v;
              const y = -v + (v * v * v) / 3 - u * u * v;
              const z = u * u - v * v;
              points.push({ x, y, z });

              const cur = i * (nv + 1) + j;
              if (j > 0) lines.push([cur - 1, cur]);
              if (i > 0) lines.push([cur - (nv + 1), cur]);
            }
          }
          return { points, lines, scale: 45 };
        }
      },

      hyperbolic_paraboloid: {
        name: 'Hyperbolic Paraboloid ($z = x^2 - y^2$)',
        equation: '$$\\vec{r}(x,y) = \\begin{pmatrix} x \\\\ y \\\\ k(x^2 - y^2) \\end{pmatrix}, \\quad \\text{Gaussian Curvature } K < 0$$',
        generate: function(uSteps, vSteps, pFactor) {
          const points = [];
          const lines = [];
          const nu = uSteps || 22;
          const nv = vSteps || 22;
          const k = 0.45 * (pFactor || 1);

          for (let i = 0; i <= nu; i++) {
            const x = ((i / nu) * 2 - 1) * 2.2;
            for (let j = 0; j <= nv; j++) {
              const y = ((j / nv) * 2 - 1) * 2.2;
              const z = k * (x * x - y * y);
              points.push({ x, y, z });

              const cur = i * (nv + 1) + j;
              if (j > 0) lines.push([cur - 1, cur]);
              if (i > 0) lines.push([cur - (nv + 1), cur]);
            }
          }
          return { points, lines, scale: 40 };
        }
      },

      clifford_torus: {
        name: 'Clifford Torus ($S^1 \\times S^1 \\subset \\mathbb{R}^4 \\to \\mathbb{R}^3$)',
        equation: '$$\\vec{r}(u,v) = \\begin{pmatrix} (R + r\\cos v)\\cos u \\\\ (R + r\\cos v)\\sin u \\\\ r\\sin v \\end{pmatrix}, \\quad R = 2.0, r = 0.9$$',
        generate: function(uSteps, vSteps, pFactor) {
          const points = [];
          const lines = [];
          const nu = uSteps || 28;
          const nv = vSteps || 16;
          const R = 2.0;
          const r = 0.9 * (pFactor || 1);

          for (let i = 0; i <= nu; i++) {
            const u = (i / nu) * Math.PI * 2;
            for (let j = 0; j <= nv; j++) {
              const v = (j / nv) * Math.PI * 2;
              const x = (R + r * Math.cos(v)) * Math.cos(u);
              const y = (R + r * Math.cos(v)) * Math.sin(u);
              const z = r * Math.sin(v);
              points.push({ x, y, z });

              const cur = i * (nv + 1) + j;
              if (j > 0) lines.push([cur - 1, cur]);
              if (i > 0) lines.push([cur - (nv + 1), cur]);
            }
          }
          return { points, lines, scale: 50 };
        }
      }
    },

    createRenderer: function(canvasId, surfaceKey, options) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      const opts = Object.assign({
        autoRotate: true,
        rotSpeedX: 0.005,
        rotSpeedY: 0.008,
        curvatureFactor: 1.0,
        interactive: true,
        showPoints: false
      }, options);

      let rotX = 0.5;
      let rotY = 0.7;
      let isDragging = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      let activeSurfaceKey = surfaceKey || 'torus_knot';
      let surfaceData = null;

      function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio || 400;
        canvas.height = rect.height * window.devicePixelRatio || 400;
      }
      resize();
      window.addEventListener('resize', resize);

      function rebuildSurface() {
        const gen = GeometryEngine.surfaces[activeSurfaceKey];
        if (gen) {
          surfaceData = gen.generate(28, 20, opts.curvatureFactor);
        }
      }
      rebuildSurface();

      // Mouse drag controls
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

        // Touch support
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

      function project(p, cx, cy, scale) {
        // Rotate Y
        let cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        let x1 = p.x * cosY + p.z * sinY;
        let y1 = p.y;
        let z1 = -p.x * sinY + p.z * cosY;

        // Rotate X
        let cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Perspective
        const fov = 400;
        const distance = 6.0;
        const depth = z2 + distance;
        const factor = depth > 0.1 ? fov / depth : 1;

        return {
          x: cx + x2 * scale * (factor / 100),
          y: cy + y2 * scale * (factor / 100),
          z: z2,
          factor: factor
        };
      }

      function render() {
        if (opts.autoRotate && !isDragging) {
          rotX += opts.rotSpeedX;
          rotY += opts.rotSpeedY;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const strokeColor = isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(79, 70, 229, 0.4)';
        const accentGlow = isDark ? '#22d3ee' : '#06b6d4';

        if (!surfaceData) {
          requestAnimationFrame(render);
          return;
        }

        // Project all points
        const proj = surfaceData.points.map(p => project(p, cx, cy, surfaceData.scale));

        // Draw Lines
        ctx.lineWidth = 1.2 * (window.devicePixelRatio || 1);
        ctx.strokeStyle = strokeColor;

        surfaceData.lines.forEach(([i, j]) => {
          const p1 = proj[i];
          const p2 = proj[j];
          if (!p1 || !p2) return;

          // Depth gradient alpha
          const avgZ = (p1.z + p2.z) / 2;
          const alpha = Math.max(0.15, Math.min(0.9, (avgZ + 3) / 6));

          ctx.beginPath();
          ctx.strokeStyle = isDark ? 
            `rgba(99, 102, 241, ${alpha})` : 
            `rgba(79, 70, 229, ${alpha * 0.85})`;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });

        // Highlight random glowing nodal points
        ctx.fillStyle = accentGlow;
        const step = Math.max(4, Math.floor(proj.length / 40));
        for (let i = 0; i < proj.length; i += step) {
          const p = proj[i];
          if (p.z > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        requestAnimationFrame(render);
      }

      requestAnimationFrame(render);

      return {
        setSurface: function(key) {
          if (GeometryEngine.surfaces[key]) {
            activeSurfaceKey = key;
            rebuildSurface();
            // Update formula display
            const formulaBox = document.getElementById('sandbox-formula-text');
            const formulaName = document.getElementById('sandbox-surface-name');
            if (formulaBox && GeometryEngine.surfaces[key].equation) {
              formulaBox.innerHTML = GeometryEngine.surfaces[key].equation;
              if (window.renderMath) window.renderMath(formulaBox);
            }
            if (formulaName) {
              formulaName.innerText = GeometryEngine.surfaces[key].name;
            }
          }
        },
        setCurvature: function(factor) {
          opts.curvatureFactor = factor;
          rebuildSurface();
        },
        setAutoRotate: function(enable) {
          opts.autoRotate = enable;
        }
      };
    }
  };

  // Initialize Page Components
  document.addEventListener('DOMContentLoaded', () => {
    window.initTheme();
    window.renderPortalMockTests();

    // Init Hero Geometry Canvas
    GeometryEngine.createRenderer('hero-geometry-canvas', 'torus_knot', {
      autoRotate: true,
      rotSpeedX: 0.003,
      rotSpeedY: 0.006
    });

    // Init Sandbox Geometry Canvas
    const sandboxEngine = GeometryEngine.createRenderer('sandbox-canvas', 'mobius', {
      autoRotate: true,
      rotSpeedX: 0.002,
      rotSpeedY: 0.005
    });

    // Sandbox Controls Wiring
    const select = document.getElementById('sandbox-surface-select');
    if (select && sandboxEngine) {
      select.addEventListener('change', (e) => {
        sandboxEngine.setSurface(e.target.value);
      });
    }

    const curvatureSlider = document.getElementById('sandbox-curvature-slider');
    const curvatureVal = document.getElementById('sandbox-curvature-val');
    if (curvatureSlider && sandboxEngine) {
      curvatureSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (curvatureVal) curvatureVal.innerText = val.toFixed(1);
        sandboxEngine.setCurvature(val);
      });
    }

    const autoRotateCheck = document.getElementById('sandbox-autorotate-check');
    if (autoRotateCheck && sandboxEngine) {
      autoRotateCheck.addEventListener('change', (e) => {
        sandboxEngine.setAutoRotate(e.target.checked);
      });
    }

    // Trigger MathJax on initial load
    if (window.renderMath) {
      window.renderMath(document.body);
    }
  });
})();
