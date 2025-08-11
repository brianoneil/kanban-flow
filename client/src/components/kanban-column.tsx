import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { TaskCard } from "./task-card";
import { Card, KanbanStatus } from "@shared/schema";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useState, useRef } from "react";

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  color: string;
  bgColor: string;
  cards: Card[];
  count: number;
  width?: number;
  onWidthChange?: (width: number) => void;
  onEditCard?: (card: Card) => void;
}

export function KanbanColumn({ id, title, color, bgColor, cards, count, width = 320, onWidthChange, onEditCard }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const getStatusDotColor = () => {
    const colors = {
      gray: "bg-gradient-to-r from-gray-400 to-gray-500 shadow-md",
      red: "bg-gradient-to-r from-red-400 to-red-500 shadow-md", 
      blue: "bg-gradient-to-r from-blue-400 to-blue-500 shadow-md",
      green: "bg-gradient-to-r from-green-400 to-green-500 shadow-md",
      purple: "bg-gradient-to-r from-purple-400 to-purple-500 shadow-md",
    };
    return colors[color as keyof typeof colors] || "bg-gradient-to-r from-gray-400 to-gray-500 shadow-md";
  };

  const getCountBadgeColor = () => {
    const colors = {
      gray: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 shadow-sm",
      red: "bg-gradient-to-r from-red-100 to-red-200 text-red-700 shadow-sm",
      blue: "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 shadow-sm", 
      green: "bg-gradient-to-r from-green-100 to-green-200 text-green-700 shadow-sm",
      purple: "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 shadow-sm",
    };
    return colors[color as keyof typeof colors] || "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 shadow-sm";
  };

  const getHeaderGradient = () => {
    const gradients = {
      gray: "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700",
      red: "bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30",
      blue: "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30",
      green: "bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30",
      purple: "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30",
    };
    return gradients[color as keyof typeof gradients] || "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(280, Math.min(600, startWidthRef.current + deltaX));
      
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "kanban-column rounded-xl overflow-hidden flex-shrink-0 relative group min-h-full transition-all duration-300 ease-in-out",
        isOver && "ring-2 ring-blue-400 ring-opacity-60 shadow-xl scale-[1.02]"
      )}
      style={{ width: `${width}px` }}
    >
      <div className="min-h-full">
        <div className={cn("px-5 py-4 border-b border-white/20 dark:border-gray-600/20", getHeaderGradient())}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn("w-4 h-4 rounded-full", getStatusDotColor())}></div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm tracking-wide uppercase">{title}</h3>
            </div>
            <span className={cn("text-xs px-3 py-1.5 rounded-full font-bold", getCountBadgeColor())}>
              {count}
            </span>
          </div>
        </div>
        
        <div
          className={cn(
            "p-5 min-h-[500px] transition-all duration-300 bg-white/50 dark:bg-gray-800/50",
            isOver && "bg-gradient-to-b from-blue-50/50 to-blue-100/30 dark:from-blue-900/30 dark:to-blue-800/20"
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
                    <TaskCard card={card} onEdit={onEditCard} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </SortableContext>
          
          {/* Drop zone for empty columns - make it more prominent when empty */}
          {cards.length === 0 ? (
            <div className={cn(
              "h-40 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center transition-all duration-200",
              isOver && "border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 border-solid"
            )}>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                Drop cards here
              </p>
            </div>
          ) : (
            <div className="h-16 w-full" />
          )}
        </div>
      </div>
      
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 right-0 w-3 h-full cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10 bg-transparent hover:bg-blue-50/20",
          isResizing && "opacity-100 bg-blue-50/30"
        )}
        title="Drag to resize column"
      >
        <div className="w-1 h-12 bg-gray-400 dark:bg-gray-500 rounded-full hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors shadow-sm"></div>
      </div>
    </div>
  );
}
