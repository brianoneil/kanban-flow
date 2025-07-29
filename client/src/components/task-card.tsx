import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, ExternalLink, CheckCircle, AlertTriangle, Shield, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, KanbanStatus } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ExplosionAnimation } from "./explosion-animation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskCardProps {
  card: Card & { 
    _remoteUpdate?: boolean; 
    _statusChanged?: boolean; 
  };
}

export function TaskCard({ card }: TaskCardProps) {
  const [isExploding, setIsExploding] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExploding(true);
  };

  const handleExplosionComplete = () => {
    setShouldHide(true);
    deleteMutation.mutate();
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
      "not-started": "border-gray-200",
      "blocked": "border-red-200", 
      "in-progress": "border-blue-200",
      "complete": "border-green-200",
      "verified": "border-purple-200",
    };
    return colors[card.status] || "border-gray-200";
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
          "task-card bg-white border rounded-lg p-4 cursor-move hover:shadow-md transition-all duration-300 hover:scale-[1.02] group relative flex flex-col",
          getBorderColor(),
          isDragging && "opacity-60 scale-105 rotate-1 shadow-lg z-50",
          card._remoteUpdate && card._statusChanged && "ring-2 ring-blue-400 ring-opacity-75",
          isExpanded && "min-h-fit"
        )}
      >
        {/* Delete button - only show on hover */}
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-md hover:bg-red-100 text-red-500 hover:text-red-700 z-10"
          title="Delete card"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 flex-1 pr-8 break-words">{card.title}</h4>
          <GripVertical className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
        </div>
        
        <div className="mb-3 flex-1">
          <motion.div
            initial={false}
            animate={{ 
              height: isExpanded ? "auto" : "auto"
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <p className={cn(
              "text-sm text-gray-600 break-words",
              !isExpanded && "line-clamp-2"
            )}>
              {card.description}
            </p>
          </motion.div>
          
          {/* Show expand/collapse button only if content is long enough */}
          {card.description && card.description.length > 100 && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1 font-medium transition-colors duration-150"
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
