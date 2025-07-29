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