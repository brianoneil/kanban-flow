export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export function parseTaskList(taskListJson?: string | null): TaskItem[] {
  if (!taskListJson) return [];
  
  try {
    const parsed = JSON.parse(taskListJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeTaskList(tasks: TaskItem[]): string {
  return JSON.stringify(tasks);
}

export function extractTasksFromMarkdown(markdown: string): TaskItem[] {
  // Extract GitHub-style task lists from markdown
  const taskRegex = /^[-*+]\s*\[([x\s])\]\s*(.+)$/gm;
  const tasks: TaskItem[] = [];
  let match;
  
  while ((match = taskRegex.exec(markdown)) !== null) {
    const text = match[2].trim();
    const isCompleted = match[1].toLowerCase() === 'x';
    
    tasks.push({
      id: text.toLowerCase().replace(/[^a-z0-9]/g, ''), // Generate stable ID from text
      text: text,
      completed: isCompleted
    });
  }
  

  return tasks;
}

export function calculateTaskProgress(tasks: TaskItem[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  return { completed, total, percentage };
}

export function updateTaskCompletion(tasks: TaskItem[], taskId: string, completed: boolean): TaskItem[] {
  return tasks.map(task => 
    task.id === taskId ? { ...task, completed } : task
  );
}

export function hasTaskList(description: string): boolean {
  return /^[-*+]\s*\[([x\s])\]/m.test(description);
}