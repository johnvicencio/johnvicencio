// ponytail: minimal helpers for native <dialog> in Blazor pickers
window.openAppDialog = function (dialog) {
    if (!dialog || dialog.open) return;
    if (!dialog.dataset.backdropClose) {
        dialog.dataset.backdropClose = 'true';
        dialog.addEventListener('click', function (event) {
            if (event.target === dialog) {
                event.preventDefault();
                dialog.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
            }
        });
    }
    dialog.showModal();
};

window.closeAppDialog = function (dialog) {
    if (dialog && dialog.open) dialog.close();
};
