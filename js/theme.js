(function () {
  'use strict';

  function getSavedTheme() {
    try {
      return localStorage.getItem('jam_theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function updateThemeIcon(theme) {
    var btns = document.querySelectorAll('#theme-toggle-btn, #theme-btn');
    var nextLabel = theme === 'dark' ? 'Light' : 'Dark';
    btns.forEach(function (btn) {
      if (btn.getAttribute('data-theme-label') === 'text') {
        btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
      } else {
        btn.textContent = theme === 'dark' ? '☀' : '🌙';
      }
      btn.title = 'Switch to ' + nextLabel + ' Mode';
    });
  }

  function initTheme() {
    var saved = getSavedTheme();
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  window.initTheme = initTheme;
  window.updateThemeIcon = updateThemeIcon;
  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('jam_theme', next);
    } catch (e) {}
    updateThemeIcon(next);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
