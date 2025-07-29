import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, ExternalLink, CheckCircle, AlertTriangle, Shield, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, KanbanStatus } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ExplosionAnimation } from "./explosion-animation";
import { parseTaskList, calculateTaskProgress, updateTaskCompletion, hasTaskList, serializeTaskList, extractTasksFromMarkdown, TaskItem } from "@/lib/task-utils";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TaskCardProps {
  card: Card & { 
    _remoteUpdate?: boolean; 
    _statusChanged?: boolean; 
  };
}

export function TaskCard({ card }: TaskCardProps) {
  const [isExploding, setIsExploding] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [isExpanded, setIsExpanded] = useState(card.status === "in-progress");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Parse task list and extract tasks from markdown if needed
  const storedTasks = parseTaskList(card.taskList);
  const markdownTasks = extractTasksFromMarkdown(card.description);
  const tasks = storedTasks.length > 0 ? storedTasks : markdownTasks;
  const taskProgress = calculateTaskProgress(tasks);
  const showProgress = tasks.length > 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/cards/${card.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Card deleted",
        description: "The card has been successfully removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete card. Please try again.",
        variant: "destructive",
      });
      // Reset animation state on error
      setIsExploding(false);
      setShouldHide(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTasks: TaskItem[]) => {
      const response = await apiRequest("PATCH", `/api/cards/${card.id}`, {
        taskList: serializeTaskList(updatedTasks)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task progress.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExploding(true);
  };

  const handleExplosionComplete = () => {
    setShouldHide(true);
    deleteMutation.mutate();
  };

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    const updatedTasks = updateTaskCompletion(tasks, taskId, completed);
    updateTaskMutation.mutate(updatedTasks);
  };

  // Hide the card completely after explosion
  if (shouldHide) {
    return null;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getBorderColor = () => {
    const colors: Record<KanbanStatus, string> = {
      "not-started": "border-l-4 border-l-gray-400",
      "blocked": "border-l-4 border-l-red-500", 
      "in-progress": "border-l-4 border-l-blue-500",
      "complete": "border-l-4 border-l-green-500",
      "verified": "border-l-4 border-l-purple-500",
    };
    return colors[card.status as KanbanStatus] || "border-l-4 border-l-gray-400";
  };

  const getStatusIcon = () => {
    switch (card.status) {
      case "blocked":
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case "in-progress":
        return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />;
      case "complete":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "verified":
        return <Shield className="w-3 h-3 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <ExplosionAnimation 
      trigger={isExploding} 
      onComplete={handleExplosionComplete}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "task-card rounded-xl p-5 cursor-move group relative flex flex-col",
          getBorderColor(),
          isDragging && "opacity-60 scale-105 rotate-2 shadow-2xl z-50",
          card._remoteUpdate && card._statusChanged && "ring-2 ring-blue-400 ring-opacity-75 animate-pulse",
          isExpanded && "min-h-fit"
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 flex-1 pr-2 break-words">{card.title}</h4>
          
          {/* Action buttons container */}
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            {/* Delete button - only show on hover */}
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-md hover:bg-red-100 text-red-500 hover:text-red-700 z-10"
              title="Delete card"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            
            {/* Drag handle */}
            <div className="p-1">
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Task Progress Bar */}
        {showProgress && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">
                Progress: {taskProgress.completed}/{taskProgress.total} tasks
              </span>
              <span className="text-xs text-gray-500 font-bold">
                {taskProgress.percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  taskProgress.percentage === 100 ? "bg-green-500" : "bg-blue-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${taskProgress.percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
        
        <div className="mb-3 flex-1">
          <motion.div
            initial={false}
            animate={{ 
              height: isExpanded ? "auto" : "auto"
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
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
                    if (node?.properties?.className?.includes('task-list-item')) {
                      return <li className="mb-1 task-list-item">{children}</li>;
                    }
                    return <li className="mb-1">{children}</li>;
                  },
                  input: ({ type, checked, ...props }) => {
                    if (type === 'checkbox') {
                      // Find the corresponding task by text content
                      const taskIndex = tasks.findIndex((task, index) => index === (props as any).taskIndex);
                      const task = tasks[taskIndex];
                      
                      return (
                        <input
                          type="checkbox"
                          checked={task?.completed || false}
                          onChange={(e) => {
                            if (task) {
                              handleTaskToggle(task.id, e.target.checked);
                            }
                          }}
                          className="mr-2 accent-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    }
                    return <input type={type} checked={checked} {...props} />;
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
                {card.description}
              </ReactMarkdown>
            </div>
          </motion.div>
          
          {/* Show expand/collapse button only if content is long enough */}
          {card.description && card.description.length > 100 && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={cn(
                "mt-2 text-xs flex items-center space-x-1 font-medium transition-colors duration-150",
                card.status === "in-progress" 
                  ? "text-blue-700 hover:text-blue-900" 
                  : "text-blue-600 hover:text-blue-800"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{isExpanded ? "Show less" : "Show more"}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.div>
            </motion.button>
          )}

          {/* Interactive Task List */}
          {tasks.length > 0 && isExpanded && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => handleTaskToggle(task.id, e.target.checked)}
                      className="w-4 h-4 accent-blue-500 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={cn(
                      "text-sm flex-1",
                      task.completed ? "line-through text-gray-500" : "text-gray-700"
                    )}>
                      {task.text}
                    </span>
                    {task.completed && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          {card.link ? (
            <a
              href={card.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>View Details</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <div></div>
          )}
          
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-xs text-gray-500">ID: {card.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </ExplosionAnimation>
  );
}
