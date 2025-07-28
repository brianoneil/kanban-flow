import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { TaskCard } from "./task-card";
import { Card, KanbanStatus } from "@shared/schema";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  color: string;
  bgColor: string;
  cards: Card[];
  count: number;
}

export function KanbanColumn({ id, title, color, bgColor, cards, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const getStatusDotColor = () => {
    const colors = {
      gray: "bg-gray-500",
      red: "bg-red-500", 
      blue: "bg-blue-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
    };
    return colors[color as keyof typeof colors] || "bg-gray-500";
  };

  const getCountBadgeColor = () => {
    const colors = {
      gray: "bg-gray-100 text-gray-600",
      red: "bg-red-100 text-red-600",
      blue: "bg-blue-100 text-blue-600", 
      green: "bg-green-100 text-green-600",
      purple: "bg-purple-100 text-purple-600",
    };
    return colors[color as keyof typeof colors] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="kanban-column">
      <div 
        ref={setNodeRef}
        className={cn(
          "bg-white rounded-lg shadow-sm border border-gray-200 min-h-full transition-colors duration-200",
          isOver && "ring-2 ring-blue-300 ring-opacity-50"
        )}
      >
        <div className={cn("px-4 py-3 border-b border-gray-200 rounded-t-lg", bgColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={cn("w-3 h-3 rounded-full", getStatusDotColor())}></div>
              <h3 className="font-semibold text-gray-800">{title}</h3>
            </div>
            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", getCountBadgeColor())}>
              {count}
            </span>
          </div>
        </div>
        
        <div
          className={cn(
            "p-4 min-h-[400px] transition-colors duration-200",
            isOver && "bg-blue-50"
          )}
        >
          <SortableContext items={cards.map(card => card.id)} strategy={verticalListSortingStrategy}>
            <motion.div className="space-y-3" layout>
              <AnimatePresence mode="popLayout">
                {cards.map(card => (
                  <motion.div
                    key={card.id}
                    layoutId={`card-${card.id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ 
                      layout: { duration: 0.5, ease: "easeInOut" },
                      opacity: { duration: 0.3 },
                      scale: { duration: 0.3 }
                    }}
                  >
                    <TaskCard card={card} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </SortableContext>
          
          {/* Drop zone for empty columns or end of column */}
          <div className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
