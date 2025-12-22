import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, LogOut } from "lucide-react";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { KanbanBoard } from "@/components/kanban-board";
import { ThemeToggle } from "@/components/theme-toggle";
import { CardsSummary } from "@/components/cards-summary";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Kanban() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const { toast } = useToast();
  const { logout } = useAuth();

  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => fetch('/api/projects').then(res => res.json())
  });

  const resetColumnWidths = () => {
    localStorage.removeItem('kanban-column-widths');
    window.location.reload();
    toast({
      title: "Column widths reset",
      description: "All columns have been restored to default width (320px).",
    });
  };

  const formatProjectName = (project: string) => {
    return project
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban Board</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Multi-Project Management</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono">
                v{__APP_VERSION__}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project: string) => (
                    <SelectItem key={project} value={project}>
                      {formatProjectName(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <CreateProjectDialog 
                open={false} 
                onOpenChange={() => {}} 
                onProjectCreated={() => {}} 
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetColumnWidths}
                className="flex items-center gap-2"
                title="Reset column widths to default"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-2"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="w-full py-8">
        <KanbanBoard selectedProject={selectedProject === "all" ? undefined : selectedProject} />
        <CardsSummary selectedProject={selectedProject === "all" ? undefined : selectedProject} />
      </main>
    </div>
  );
}
