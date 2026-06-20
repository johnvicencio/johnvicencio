window.richEditor = {
  format: function (editorId, command, value) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.focus();
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
    return editor ? editor.innerHTML : '';
  },

  setHtml: function (editorId, html) {
    const editor = document.getElementById(editorId);
    if (editor) {
      editor.innerHTML = html || '';
    }
  },

  toggleSource: function (editorId, textareaId) {
    const editor = document.getElementById(editorId);
    const textarea = document.getElementById(textareaId);
    if (!editor || !textarea) return false;
    if (editor.style.display === 'none') {
      editor.innerHTML = textarea.value;
      editor.style.display = 'block';
      textarea.style.display = 'none';
      return false;
    } else {
      textarea.value = editor.innerHTML;
      textarea.style.display = 'block';
      editor.style.display = 'none';
      return true;
    }
  }
};
