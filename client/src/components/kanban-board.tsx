import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, rectIntersection, PointerSensor, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, LayoutGroup } from "framer-motion";

import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { AddCardDialog } from "./add-card-dialog";

import { EditCardDialog } from "./edit-card-dialog";
import { Button } from "@/components/ui/button";

import { Plus, Filter, RotateCcw } from "lucide-react";

import { Card, KANBAN_STATUSES, KanbanStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

// Default column widths
const DEFAULT_COLUMN_WIDTHS: Record<KanbanStatus, number> = {
  "not-started": 320,
  "blocked": 320,
  "in-progress": 320,
  "complete": 320,
  "verified": 320,
};

// Load saved column widths from localStorage
const loadColumnWidths = (): Record<KanbanStatus, number> => {
  try {
    const saved = localStorage.getItem('kanban-column-widths');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate that all required statuses are present and values are numbers
      const isValid = KANBAN_STATUSES.every(status => 
        typeof parsed[status] === 'number' && 
        parsed[status] >= 280 && 
        parsed[status] <= 600
      );
      if (isValid) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load column widths from localStorage:', error);
  }
  return DEFAULT_COLUMN_WIDTHS;
};

// Save column widths to localStorage
const saveColumnWidths = (widths: Record<KanbanStatus, number>) => {
  try {
    localStorage.setItem('kanban-column-widths', JSON.stringify(widths));
  } catch (error) {
    console.warn('Failed to save column widths to localStorage:', error);
  }
};

interface KanbanBoardProps {
  selectedProject?: string;
}

export function KanbanBoard({ selectedProject }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<KanbanStatus, number>>(loadColumnWidths);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocket();
  
  // Use the selectedProject passed as prop
  
  // Handle column width changes
  const handleColumnWidthChange = (status: KanbanStatus, newWidth: number) => {
    const updatedWidths = {
      ...columnWidths,
      [status]: newWidth
    };
    setColumnWidths(updatedWidths);
    saveColumnWidths(updatedWidths);
  };

  // Reset all column widths to defaults
  const resetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    saveColumnWidths(DEFAULT_COLUMN_WIDTHS);
    toast({
      title: "Column widths reset",
      description: "All columns have been reset to default width.",
    });
  };

  // Handle card editing
  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setShowEditDialog(true);
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
      const url = selectedProject 
        ? `/api/cards?project=${encodeURIComponent(selectedProject)}`
        : '/api/cards';
      const response = await fetch(url);
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
      // Don't invalidate immediately for drag operations to avoid flicker
      // The optimistic update handles the UI, server response confirms it
    },
    onError: () => {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedProject] });
      toast({
        title: "Error",
        description: "Failed to update card. Changes reverted.",
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
      // If we're dropping on a column (status ID)
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
        // We're dropping on a card - check if it's the same status or different
        const overCard = cards.find(card => card.id === overId);
        
        if (overCard) {
          if (activeCard.status === overCard.status) {
            // Same column reordering
            const statusCards = getCardsByStatus(activeCard.status as KanbanStatus);
            const activeIndex = statusCards.findIndex(card => card.id === activeId);
            const overIndex = statusCards.findIndex(card => card.id === overId);
            
            if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
              const reorderedCards = arrayMove(statusCards, activeIndex, overIndex);
              
              // Update the order for all cards in this status
              const allCardsWithNewOrder = cards.map(card => {
                if (card.status === activeCard.status) {
                  const reorderedIndex = reorderedCards.findIndex(c => c.id === card.id);
                  if (reorderedIndex !== -1) {
                    return { ...card, order: (reorderedIndex + 1).toString() };
                  }
                }
                return card;
              });
              
              // Optimistic update
              queryClient.setQueryData(["/api/cards", selectedProject], allCardsWithNewOrder);
              
              // Update all affected cards' orders through batch API
              const orderUpdates = reorderedCards.map((card, index) => ({
                id: card.id,
                updates: { order: (index + 1).toString() }
              }));
              
              // For now, just update the moved card - we could add batch update later
              const activeCardNewIndex = reorderedCards.findIndex(c => c.id === activeCard.id);
              updateCardMutation.mutate({
                id: activeCard.id,
                updates: { order: (activeCardNewIndex + 1).toString() }
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
      <div className="w-full overflow-x-auto">
        <div className="flex gap-6 min-h-screen pb-4 px-6">
          {KANBAN_STATUSES.map(status => (
            <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4" style={{ width: DEFAULT_COLUMN_WIDTHS[status], minWidth: DEFAULT_COLUMN_WIDTHS[status] }}>
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {isConnected ? "Real-time updates active" : "Connecting..."}
            </span>
          </div>
          

        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
          <Button 
            variant="outline" 
            onClick={resetColumnWidths}
            className="bg-gradient-to-r from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300 dark:from-orange-700 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-500 text-orange-700 dark:text-orange-200 border-orange-300 dark:border-orange-600 shadow-md hover:shadow-lg transition-all duration-300"
            title="Reset column widths to default"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 dark:from-gray-700 dark:to-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-500 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all duration-300">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <LayoutGroup>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={pointerWithin}
          >
            <div className="flex gap-6 min-h-screen pb-4 px-6">
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
                    onEditCard={handleEditCard}
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
        project={selectedProject || ""}
      />

      {editingCard && (
        <EditCardDialog
          card={editingCard}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setEditingCard(null);
            }
          }}
        />
      )}
    </>
  );
}
