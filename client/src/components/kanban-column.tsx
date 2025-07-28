import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-full">
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
          ref={setNodeRef}
          className={cn(
            "p-4 space-y-3 min-h-[200px] transition-colors duration-200",
            isOver && "bg-blue-50"
          )}
        >
          <SortableContext items={cards.map(card => card.id)} strategy={verticalListSortingStrategy}>
            {cards.map(card => (
              <TaskCard key={card.id} card={card} />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
