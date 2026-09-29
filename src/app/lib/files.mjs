// File downloads and clipboard copies.

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  if (!navigator.clipboard || !window.isSecureContext) throw Error('Clipboard unavailable.');
  await navigator.clipboard.writeText(text);
}
