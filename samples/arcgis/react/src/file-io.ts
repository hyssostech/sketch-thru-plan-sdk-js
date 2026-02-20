/**
 * Browser file I/O helpers using the standard File System Access API
 * (with fallbacks for browsers that don't support it).
 */

/**
 * Prompt the user to save `content` to a file via a "Save As" dialog.
 * Falls back to a hidden <a download> trick when the File System Access API
 * is unavailable.
 */
export async function saveToFile(
  content: string,
  suggestedName: string,
  description: string = 'STP files',
  extensions: string[] = ['.op']
): Promise<string | null> {
  // Try File System Access API first (Chrome/Edge)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description,
          accept: { 'text/plain': extensions },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return handle.name;
    } catch (e: any) {
      if (e.name === 'AbortError') return null; // user cancelled
      throw e;
    }
  }

  // Fallback: download via hidden <a>
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return suggestedName;
}

/**
 * Prompt the user to pick a file via an "Open" dialog and return its text
 * content.  Falls back to a hidden <input type="file"> when the File System
 * Access API is unavailable.
 */
export async function loadFromFile(
  description: string = 'STP files',
  extensions: string[] = ['.op']
): Promise<{ name: string; content: string } | null> {
  // Try File System Access API first (Chrome/Edge)
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description,
          accept: { 'text/plain': extensions },
        }],
        multiple: false,
      });
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content };
    } catch (e: any) {
      if (e.name === 'AbortError') return null; // user cancelled
      throw e;
    }
  }

  // Fallback: hidden <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.join(',');
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const content = await file.text();
      resolve({ name: file.name, content });
      document.body.removeChild(input);
    };
    // Handle cancel (input won't fire onchange)
    input.addEventListener('cancel', () => {
      resolve(null);
      document.body.removeChild(input);
    });
    document.body.appendChild(input);
    input.click();
  });
}
