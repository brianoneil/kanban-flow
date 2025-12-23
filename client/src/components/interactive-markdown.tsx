import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { TaskItem } from '@/lib/task-utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface InteractiveMarkdownProps {
  content: string;
  tasks: TaskItem[];
  onTaskToggle: (taskText: string, completed: boolean) => void;
  isExpanded: boolean;
}

export function InteractiveMarkdown({ content, tasks, onTaskToggle, isExpanded }: InteractiveMarkdownProps) {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  return (
    <>
      <div className={cn(
        "text-sm text-gray-600 break-words prose prose-sm max-w-none",
        !isExpanded && "line-clamp-2"
      )}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
          // Override styles for better card appearance
          p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-700 dark:text-gray-300">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-2">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4">{children}</ol>,
          li: ({ children, node }) => {
            // Check if this is a task list item with remarkGfm
            const isTaskListItem = Array.isArray(node?.properties?.className) 
              ? node.properties.className.includes('task-list-item')
              : typeof node?.properties?.className === 'string' 
              ? node.properties.className.includes('task-list-item')
              : false;
            
            if (isTaskListItem) {
              // Extract the text content from children
              const textContent = extractTextFromChildren(children);
              const taskText = textContent.replace(/^\[([x\s])\]\s*/, '').trim();
              const task = tasks.find(t => t.text === taskText);
              
              return (
                <li className="mb-1 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors task-list-item">
                  <input
                    type="checkbox"
                    checked={task?.completed ?? false}
                    onChange={(e) => {
                      onTaskToggle(taskText, e.target.checked);
                    }}
                    className="w-3.5 h-3.5 accent-blue-500 dark:accent-blue-400 rounded flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={cn(
                    "text-xs leading-4 flex-1",
                    task?.completed ? "line-through text-gray-500 dark:text-gray-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {taskText}
                  </span>
                </li>
              );
            }
            return <li className="mb-1 ml-4 text-xs text-gray-700 dark:text-gray-300">{children}</li>;
          },
          code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs text-gray-800 dark:text-gray-200">{children}</code>,
          strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
          h1: ({ children }) => <h1 className="text-base font-semibold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-medium mb-1">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-2 italic">{children}</blockquote>,
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => {
            // Parse Obsidian-style width syntax: ![alt|width](url)
            let displayAlt = alt || '';
            let width: string | undefined;
            
            if (displayAlt.includes('|')) {
              const parts = displayAlt.split('|');
              displayAlt = parts[0].trim();
              const widthValue = parts[1].trim();
              
              // Support both pixel values (200) and percentages (50%)
              if (widthValue) {
                width = widthValue.includes('%') ? widthValue : `${widthValue}px`;
              }
            }
            
            return (
              <img
                src={src}
                alt={displayAlt}
                loading="lazy"
                className="rounded-lg max-w-full h-auto my-2 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                style={width ? { maxWidth: width } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ src: src || '', alt: displayAlt });
                }}
                onError={(e) => {
                  // Handle broken images gracefully
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorMsg = document.createElement('div');
                  errorMsg.className = 'text-xs text-red-500 italic my-2';
                  errorMsg.textContent = `⚠️ Image failed to load: ${displayAlt || 'untitled'}`;
                  target.parentNode?.insertBefore(errorMsg, target);
                }}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      </div>

      {/* Lightbox for full-size image viewing */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          {lightboxImage && (
            <div className="flex items-center justify-center w-full h-full p-8">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-w-full max-h-[90vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (React.isValidElement(children)) {
    return extractTextFromChildren(children.props.children);
  }
  return '';
}