/**
 * Utility functions for handling image uploads to R2 storage
 */

/**
 * Upload an image file to the server
 * @param file Image file to upload
 * @returns Promise with the uploaded image URL
 */
export async function uploadImage(file: File): Promise<string> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG).');
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File is too large. Maximum size is 10MB.');
  }

  // Create form data
  const formData = new FormData();
  formData.append('image', file);

  // Upload to server
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
    credentials: 'include', // Include session cookie
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload image');
  }

  const data = await response.json();
  return data.url;
}

/**
 * Generate markdown syntax for an image
 * @param url Image URL
 * @param alt Alt text (filename by default)
 * @returns Markdown image syntax
 */
export function generateImageMarkdown(url: string, alt: string = 'image'): string {
  return `![${alt}](${url})`;
}

/**
 * Handle image paste from clipboard
 * @param event Clipboard event
 * @param onUpload Callback when upload is complete
 * @param onError Callback when error occurs
 */
export async function handleImagePaste(
  event: ClipboardEvent,
  onUpload: (markdown: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;

      try {
        const url = await uploadImage(file);
        const markdown = generateImageMarkdown(url, 'pasted-image');
        onUpload(markdown);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Failed to upload image');
      }
      break;
    }
  }
}

/**
 * Handle image drop from drag & drop
 * @param event Drop event
 * @param onUpload Callback when upload is complete
 * @param onError Callback when error occurs
 */
export async function handleImageDrop(
  event: DragEvent,
  onUpload: (markdown: string) => void,
  onError: (error: string) => void,
  onProgress?: (progress: number) => void
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // Process only the first image file
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      try {
        onProgress?.(50); // Start progress
        const url = await uploadImage(file);
        onProgress?.(100); // Complete progress
        const markdown = generateImageMarkdown(url, file.name.split('.')[0]);
        onUpload(markdown);
      } catch (error) {
        onProgress?.(0); // Reset progress
        onError(error instanceof Error ? error.message : 'Failed to upload image');
      }
      break;
    }
  }
}

/**
 * Insert text at cursor position in a textarea
 * @param textarea Textarea element
 * @param text Text to insert
 */
export function insertTextAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;
  
  // Insert text at cursor position
  const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
  textarea.value = newValue;
  
  // Move cursor to end of inserted text
  const newCursorPos = start + text.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  // Trigger input event so React updates
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
  
  // Focus the textarea
  textarea.focus();
}

