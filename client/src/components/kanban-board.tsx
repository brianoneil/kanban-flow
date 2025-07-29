import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, LayoutGroup } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { AddCardDialog } from "./add-card-dialog";
import { CreateProjectDialog } from "./create-project-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter, Folder, FolderPlus } from "lucide-react";
import { Card, KANBAN_STATUSES, KanbanStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

export function KanbanBoard() {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<KanbanStatus, number>>({
    "not-started": 320,
    "blocked": 320,
    "in-progress": 320,
    "complete": 320,
    "verified": 320,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocket();
  const [location, setLocation] = useLocation();
  const params = useParams();
  
  // Get current project from URL parameter or default to first available
  const { data: projects = [] } = useQuery<string[]>({
    queryKey: ["/api/projects"],
  });
  
  const urlProject = params.project;
  const [selectedProject, setSelectedProject] = useState<string>(
    urlProject || "ecommerce-platform"
  );
  
  // Update selected project when URL changes or projects load
  useEffect(() => {
    if (urlProject && projects.includes(urlProject)) {
      setSelectedProject(urlProject);
    } else if (!urlProject && projects.length > 0) {
      // If no project in URL, redirect to the first project
      setLocation(`/project/${projects[0]}`);
    }
  }, [urlProject, projects, setLocation]);
  
  // Handle project selection and URL update
  const handleProjectChange = (project: string) => {
    setSelectedProject(project);
    setLocation(`/project/${project}`);
  };

  // Handle new project creation
  const handleProjectCreated = (projectName: string) => {
    setSelectedProject(projectName);
    setLocation(`/project/${projectName}`);
  };
  
  // Handle column width changes
  const handleColumnWidthChange = (status: KanbanStatus, newWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [status]: newWidth
    }));
  };
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards", selectedProject],
    queryFn: async () => {
      const response = await fetch(`/api/cards?project=${selectedProject}`);
      if (!response.ok) throw new Error('Failed to fetch cards');
      return response.json();
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Card> }) => {
      const response = await apiRequest("PATCH", `/api/cards/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedProject] });
      toast({
        title: "Card updated",
        description: "Card status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update card status.",
        variant: "destructive",
      });
    },
  });

  const getCardsByStatus = (status: KanbanStatus) => {
    return cards
      .filter(card => card.status === status)
      .sort((a, b) => parseInt(a.order) - parseInt(b.order));
  };

  const getColumnConfig = (status: KanbanStatus) => {
    const configs = {
      "not-started": { title: "Not Started", color: "gray", bgColor: "bg-gradient-to-r from-gray-50 to-slate-50" },
      "blocked": { title: "Blocked", color: "red", bgColor: "bg-gradient-to-r from-red-50 to-rose-50" },
      "in-progress": { title: "In Progress", color: "blue", bgColor: "bg-gradient-to-r from-blue-50 to-indigo-50" },
      "complete": { title: "Complete", color: "green", bgColor: "bg-gradient-to-r from-green-50 to-emerald-50" },
      "verified": { title: "Verified", color: "purple", bgColor: "bg-gradient-to-r from-purple-50 to-violet-50" },
    };
    return configs[status];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find(c => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !activeCard) {
      setActiveCard(null);
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();
    
    // Immediately apply optimistic updates for smoother UX
    const optimisticUpdate = () => {
      // If we're dropping on a column
      if (KANBAN_STATUSES.includes(overId as KanbanStatus)) {
        const newStatus = overId as KanbanStatus;
        if (activeCard.status !== newStatus) {
          // Optimistically move card to new column
          const updatedCards = cards.map(card => 
            card.id === activeCard.id 
              ? { ...card, status: newStatus }
              : card
          );
          queryClient.setQueryData(["/api/cards", selectedProject], updatedCards);
          
          updateCardMutation.mutate({
            id: activeCard.id,
            updates: { status: newStatus }
          });
        }
      } else {
        // We're dropping on a card
        const overCard = cards.find(card => card.id === overId);
        
        if (overCard) {
          // Same column reordering
          if (activeCard.status === overCard.status) {
            const statusCards = getCardsByStatus(activeCard.status);
            const activeIndex = statusCards.findIndex(card => card.id === activeId);
            const overIndex = statusCards.findIndex(card => card.id === overId);
            
            if (activeIndex !== overIndex) {
              const reorderedCards = arrayMove(statusCards, activeIndex, overIndex);
              
              // Update the order for all cards in this status
              const allCardsWithNewOrder = cards.map(card => {
                if (card.status === activeCard.status) {
                  const newIndex = reorderedCards.findIndex(c => c.id === card.id);
                  return { ...card, order: (newIndex + 1).toString() };
                }
                return card;
              });
              
              // Optimistic update
              queryClient.setQueryData(["/api/cards", selectedProject], allCardsWithNewOrder);
              
              // Update the moved card's order
              const newOrder = (overIndex + 1).toString();
              updateCardMutation.mutate({
                id: activeCard.id,
                updates: { order: newOrder }
              });
            }
          } else {
            // Different column - move to that column
            const updatedCards = cards.map(card => 
              card.id === activeCard.id 
                ? { ...card, status: overCard.status }
                : card
            );
            queryClient.setQueryData(["/api/cards", selectedProject], updatedCards);
            
            updateCardMutation.mutate({
              id: activeCard.id,
              updates: { status: overCard.status }
            });
          }
        }
      }
    };

    // Apply optimistic update immediately
    optimisticUpdate();
    
    // Clear active card immediately since we're using optimistic updates
    setActiveCard(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {KANBAN_STATUSES.map(status => (
          <div key={status} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-300 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? "Real-time updates active" : "Connecting..."}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-gray-500" />
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project} value={project}>
                    {project.charAt(0).toUpperCase() + project.slice(1).replace('-', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateProjectDialog(true)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              title="Create new project"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
          <Button variant="outline" className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 border-gray-300 shadow-md hover:shadow-lg transition-all duration-300">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <LayoutGroup>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
          >
            <div className="flex gap-6 min-h-screen pb-4">
            {KANBAN_STATUSES.map(status => {
              const config = getColumnConfig(status);
              const columnCards = getCardsByStatus(status);
              
              return (
                <KanbanColumn
                  key={status}
                  id={status}
                  title={config.title}
                  color={config.color}
                  bgColor={config.bgColor}
                  cards={columnCards}
                  count={columnCards.length}
                  width={columnWidths[status]}
                  onWidthChange={(newWidth) => handleColumnWidthChange(status, newWidth)}
                />
              );
            })}
          </div>
        
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <motion.div
              initial={{ rotate: 2, scale: 1.05, opacity: 0.9 }}
              animate={{ rotate: 2, scale: 1.05, opacity: 0.9 }}
              exit={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="shadow-2xl"
            >
              <TaskCard card={activeCard} />
            </motion.div>
          ) : null}
        </DragOverlay>
          </DndContext>
        </LayoutGroup>
      </div>

      <AddCardDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        project={selectedProject}
      />
      
      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        onProjectCreated={handleProjectCreated}
      />
    </>
  );
}
