/**
 * MathJax 3 Configuration for IIT JAM Mock Tests
 */
let mathJaxRenderQueue = Promise.resolve();

window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: {'[+]': ['base', 'ams', 'noerrors', 'noundefined', 'newcommand', 'mathtools']}
  },
  options: {
    ignoreHtmlClass: 'tex2jax_ignore',
    processHtmlClass: 'tex2jax_process',
    enableMenu: false
  },
  svg: {
    fontCache: 'global'
  },
  startup: {
    ready: () => {
      MathJax.startup.defaultReady();
      console.log('MathJax 3 initialized and ready.');
      if (window.onMathJaxReady) {
        try {
          window.onMathJaxReady();
        } catch (e) {
          console.error('Error in onMathJaxReady handler:', e);
        }
      }
    }
  }
};

/**
 * Robust helper to render math inside a specific DOM element or document.
 * Queues renders sequentially to avoid collision and waits for startup if pending.
 */
window.renderMath = function(targetElement) {
  const getElements = () => {
    if (!targetElement) return undefined;
    if (Array.isArray(targetElement)) return targetElement;
    if (targetElement instanceof NodeList || targetElement instanceof HTMLCollection) return Array.from(targetElement);
    return [targetElement];
  };

  mathJaxRenderQueue = mathJaxRenderQueue
    .then(() => {
      if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        return window.MathJax.startup.promise;
      }
      return Promise.resolve();
    })
    .then(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        const els = getElements();
        if (window.MathJax.typesetClear && els) {
          window.MathJax.typesetClear(els);
        }
        return window.MathJax.typesetPromise(els);
      }
      return Promise.resolve();
    })
    .catch(err => {
      console.warn('MathJax typeset error:', err);
    });

  return mathJaxRenderQueue;
};

