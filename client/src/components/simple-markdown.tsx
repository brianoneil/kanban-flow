import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for release notes without task list functionality
 */
export function SimpleMarkdown({ content, className = '' }: SimpleMarkdownProps) {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  return (
    <>
      <div className={className}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-700 dark:text-gray-300">{children}</p>,
            ul: ({ children }) => <ul className="mb-3 last:mb-0 ml-4 list-disc">{children}</ul>,
            ol: ({ children }) => <ol className="mb-3 last:mb-0 ml-4 list-decimal">{children}</ol>,
            li: ({ children }) => <li className="mb-1 text-gray-700 dark:text-gray-300">{children}</li>,
            code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm text-gray-800 dark:text-gray-200 font-mono">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
            strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
            em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
            h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0 text-gray-900 dark:text-gray-100">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-3 first:mt-0 text-gray-900 dark:text-gray-100">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-2 first:mt-0 text-gray-900 dark:text-gray-100">{children}</h3>,
            h4: ({ children }) => <h4 className="text-base font-semibold mb-2 mt-2 first:mt-0 text-gray-900 dark:text-gray-100">{children}</h4>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-3 text-gray-600 dark:text-gray-400">{children}</blockquote>,
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </a>
            ),
            hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
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
                  className="rounded-lg max-w-full h-auto my-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
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
                    errorMsg.className = 'text-sm text-red-500 italic my-2';
                    errorMsg.textContent = `⚠️ Image failed to load: ${displayAlt || 'untitled'}`;
                    target.parentNode?.insertBefore(errorMsg, target);
                  }}
                />
              );
            },
            table: ({ children }) => (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
            tbody: ({ children }) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>,
            tr: ({ children }) => <tr>{children}</tr>,
            th: ({ children }) => <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{children}</td>,
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
