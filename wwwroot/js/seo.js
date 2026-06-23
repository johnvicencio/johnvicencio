window.setPageMeta = function (opts) {
  var title = opts.title || '';
  var description = opts.description || '';
  var image = opts.image || '';

  if (title) document.title = title;

  var metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  if (description) metaDesc.content = description;

  var ogPairs = [];
  if (title) ogPairs.push(['og:title', title]);
  if (description) ogPairs.push(['og:description', description]);
  if (image) ogPairs.push(['og:image', image]);
  ogPairs.push(['og:url', window.location.href]);

  ogPairs.forEach(function (pair) {
    var el = document.querySelector('meta[property="' + pair[0] + '"]');
    if (el) el.content = pair[1];
  });
};

window.scrollToPagination = function () {
  var nav = document.querySelector('.table-pagination');
  if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.scrollToNav = function () {
  var nav = document.querySelector('.post-navigation');
  if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
