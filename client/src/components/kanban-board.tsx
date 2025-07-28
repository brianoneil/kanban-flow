import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { AddCardDialog } from "./add-card-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { Card, KANBAN_STATUSES, KanbanStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function KanbanBoard() {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Card> }) => {
      const response = await apiRequest("PATCH", `/api/cards/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
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
    return cards.filter(card => card.status === status);
  };

  const getColumnConfig = (status: KanbanStatus) => {
    const configs = {
      "not-started": { title: "Not Started", color: "gray", bgColor: "bg-gray-50" },
      "blocked": { title: "Blocked", color: "red", bgColor: "bg-red-50" },
      "in-progress": { title: "In Progress", color: "blue", bgColor: "bg-blue-50" },
      "complete": { title: "Complete", color: "green", bgColor: "bg-green-50" },
      "verified": { title: "Verified", color: "purple", bgColor: "bg-purple-50" },
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

    const overId = over.id.toString();
    
    // Check if dropped on a column
    if (KANBAN_STATUSES.includes(overId as KanbanStatus)) {
      const newStatus = overId as KanbanStatus;
      if (activeCard.status !== newStatus) {
        updateCardMutation.mutate({
          id: activeCard.id,
          updates: { status: newStatus }
        });
      }
    }

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
      <div className="flex items-center justify-end mb-6 space-x-3">
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Card
        </Button>
        <Button variant="outline" className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 min-h-screen">
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
              />
            );
          })}
        </div>
        
        <DragOverlay>
          {activeCard ? (
            <motion.div
              initial={{ rotate: 5, scale: 1.05 }}
              animate={{ rotate: 5, scale: 1.05 }}
              className="opacity-90"
            >
              <TaskCard card={activeCard} />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddCardDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </>
  );
}
