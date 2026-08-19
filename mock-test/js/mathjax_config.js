/**
 * MathJax 3 Configuration for IIT JAM Mock Tests
 */
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: {'[+]': ['base', 'ams', 'noerrors', 'noundefined']}
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
        window.onMathJaxReady();
      }
    }
  }
};

/**
 * Helper to render math inside a specific DOM element or document
 */
window.renderMath = function(targetElement) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    const el = targetElement ? [targetElement] : undefined;
    return MathJax.typesetPromise(el).catch(err => {
      console.warn('MathJax typeset error:', err);
    });
  }
  return Promise.resolve();
};
