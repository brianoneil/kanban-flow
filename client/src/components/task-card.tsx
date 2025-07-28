import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ExternalLink, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { Card } from "@shared/schema";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  card: Card;
}

export function TaskCard({ card }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getBorderColor = () => {
    const colors = {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "task-card bg-white border rounded-lg p-4 cursor-move hover:shadow-md transition-all duration-300 hover:scale-[1.02]",
        getBorderColor(),
        isDragging && "opacity-60 scale-105 rotate-1 shadow-lg z-50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 flex-1 line-clamp-2">{card.title}</h4>
        <GripVertical className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
      </div>
      
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{card.description}</p>
      
      <div className="flex items-center justify-between">
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
  );
}
