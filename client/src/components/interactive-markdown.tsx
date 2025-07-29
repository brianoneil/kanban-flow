import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { TaskItem } from '@/lib/task-utils';

interface InteractiveMarkdownProps {
  content: string;
  tasks: TaskItem[];
  onTaskToggle: (taskText: string, completed: boolean) => void;
  isExpanded: boolean;
}

export function InteractiveMarkdown({ content, tasks, onTaskToggle, isExpanded }: InteractiveMarkdownProps) {
  return (
    <div className={cn(
      "text-sm text-gray-600 break-words prose prose-sm max-w-none",
      !isExpanded && "line-clamp-2"
    )}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Override styles for better card appearance
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4">{children}</ol>,
          li: ({ children, node }) => {
            // Check if this is a task list item
            const textContent = extractTextFromChildren(children);
            const isTaskItem = /^\[([x\s])\]/.test(textContent);
            
            if (isTaskItem) {
              const match = textContent.match(/^\[([x\s])\]\s*(.+)$/);
              if (match) {
                const isChecked = match[1].toLowerCase() === 'x';
                const taskText = match[2].trim();
                const task = tasks.find(t => t.text === taskText);
                
                return (
                  <li className="mb-1 flex items-center space-x-2 p-1 rounded hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={task?.completed || isChecked}
                      onChange={(e) => onTaskToggle(taskText, e.target.checked)}
                      className="w-4 h-4 accent-blue-500 rounded flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={cn(
                      "text-sm flex-1",
                      (task?.completed || isChecked) ? "line-through text-gray-500" : "text-gray-700"
                    )}>
                      {taskText}
                    </span>
                  </li>
                );
              }
            }
            return <li className="mb-1">{children}</li>;
          },
          code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{children}</code>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
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