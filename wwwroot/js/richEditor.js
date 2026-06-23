window.richEditor = {
  init: function (editorId) {
    const editor = document.getElementById(editorId);
    if (!editor || editor.dataset.richEditorInitialized === 'true') return;

    editor.dataset.richEditorInitialized = 'true';
    document.execCommand('defaultParagraphSeparator', false, 'p');
    editor.addEventListener('focus', function () {
      document.execCommand('defaultParagraphSeparator', false, 'p');
      if (isEditorEmpty(editor)) {
        editor.innerHTML = '<p><br></p>';
        placeCaretInFirstParagraph(editor);
      }
    });
  },

  format: function (editorId, command, value) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    if (command === 'createLink') {
      const url = value || prompt('Enter URL:');
      if (url) document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false, value || null);
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  },

  getHtml: function (editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return '';
    normalizeParagraphs(editor);
    return isEditorEmpty(editor) ? '' : editor.innerHTML;
  },

  setHtml: function (editorId, html) {
    const editor = document.getElementById(editorId);
    if (editor) {
      editor.innerHTML = html || '';
      normalizeParagraphs(editor);
    }
  },

  toggleSource: function (editorId, textareaId) {
    const editor = document.getElementById(editorId);
    const textarea = document.getElementById(textareaId);
    if (!editor || !textarea) return false;
    if (editor.style.display === 'none') {
      editor.innerHTML = textarea.value;
      normalizeParagraphs(editor);
      editor.style.display = 'block';
      textarea.style.display = 'none';
      return false;
    } else {
      normalizeParagraphs(editor);
      textarea.value = editor.innerHTML;
      textarea.style.display = 'block';
      editor.style.display = 'none';
      return true;
    }
  }
};

function isEditorEmpty(editor) {
  const text = editor.textContent.replace(/\u00a0/g, '').trim();
  return text === '' && !editor.querySelector('img, iframe, video, ul, ol, table');
}

function placeCaretInFirstParagraph(editor) {
  const paragraph = editor.querySelector('p');
  if (!paragraph) return;

  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(true);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function normalizeParagraphs(editor) {
  const paragraphTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE']);
  const children = Array.from(editor.childNodes);

  children.forEach(function (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim() === '') {
        node.remove();
        return;
      }

      const p = document.createElement('p');
      p.textContent = node.textContent;
      node.parentNode.replaceChild(p, node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.tagName === 'DIV') {
      const p = document.createElement('p');
      p.innerHTML = node.innerHTML || '<br>';
      node.parentNode.replaceChild(p, node);
      return;
    }

    if (node.tagName === 'BR') {
      node.remove();
      return;
    }

    if (!paragraphTags.has(node.tagName)) {
      const p = document.createElement('p');
      p.innerHTML = node.outerHTML;
      node.parentNode.replaceChild(p, node);
    }
  });

  if (editor.childNodes.length === 0 && document.activeElement === editor) {
    editor.innerHTML = '<p><br></p>';
  }
}

window.customLucideIcons = {
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  github: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z",
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
};

window.ensureCustomLucideIcons = function () {
  if (!window.lucide) return false;

  lucide.Linkedin = [["path", {
    d: window.customLucideIcons.linkedin,
    fill: "currentColor",
    stroke: "none"
  }]];
  lucide.Github = [["path", {
    d: window.customLucideIcons.github,
    fill: "currentColor",
    stroke: "none"
  }]];
  lucide.Twitter = [["path", {
    d: window.customLucideIcons.twitter,
    fill: "currentColor",
    stroke: "none"
  }]];

  if (!lucide.__customIconPatchApplied) {
    const originalCreateIcons = lucide.createIcons.bind(lucide);
    lucide.createIcons = function () {
      const result = originalCreateIcons.apply(lucide, arguments);
      window.renderCustomLucideIcons();
      return result;
    };
    lucide.__customIconPatchApplied = true;
  }

  return true;
};

window.refreshLucideIcons = function () {
  if (!window.lucide || typeof window.lucide.createIcons !== "function") {
    return false;
  }

  window.ensureCustomLucideIcons();

  const pending = document.querySelectorAll("i[data-lucide]");
  if (pending.length > 0) {
    window.lucide.createIcons();
  } else if (typeof window.renderCustomLucideIcons === "function") {
    window.renderCustomLucideIcons();
  }

  return true;
};

window.renderCustomLucideIcons = function () {
  Object.keys(window.customLucideIcons || {}).forEach(function (name) {
    document.querySelectorAll('[data-lucide]').forEach(function (icon) {
      const iconName = (icon.getAttribute('data-lucide') || '').trim().toLowerCase();
      if (iconName !== name) return;
      if (icon.tagName.toLowerCase() === 'svg' && icon.classList.contains('lucide-' + name)) return;

      const attrs = Array.from(icon.attributes).reduce(function (result, attr) {
        result[attr.name] = attr.value;
        return result;
      }, {});
      const className = ['lucide', 'lucide-' + name, attrs.class || ''].filter(Boolean).join(' ');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const mergedAttrs = {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '24',
        height: '24',
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        stroke: 'none',
        'data-lucide': name,
        ...attrs,
        class: className
      };

      Object.keys(mergedAttrs).forEach(function (attrName) {
        svg.setAttribute(attrName, mergedAttrs[attrName]);
      });
      svg.innerHTML = '<path d="' + window.customLucideIcons[name] + '" />';
      icon.parentNode.replaceChild(svg, icon);
    });
  });
};

window.getLucideIcons = function () {
  window.ensureCustomLucideIcons();

  return Object.keys(lucide)
    .filter(function (k) { return Array.isArray(lucide[k]) && k[0] === k[0].toUpperCase(); })
    .map(function (k) {
      return k
        .replace(/([A-Z0-9]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
        .toLowerCase();
    })
    .sort();
};
