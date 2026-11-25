(function () {
  var el = document.getElementById('last-updated-text');
  if (!el || !document.lastModified) return;

  var d = new Date(document.lastModified);
  if (isNaN(d.getTime())) return;

  var formatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).format(d);

  el.textContent = 'Last updated: ' + formatted + ' IST';
})();
