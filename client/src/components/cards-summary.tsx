import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Download, RefreshCw } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";

interface CardSummary {
  id: string;
  title: string;
  status: string;
  project: string;
  order: string;
}

interface CardsSummaryProps {
  selectedProject?: string;
  className?: string;
}

const statusColors = {
  'not-started': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  'blocked': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'complete': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'verified': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
};

const statusLabels = {
  'not-started': 'Not Started',
  'blocked': 'Blocked',
  'in-progress': 'In Progress',
  'complete': 'Complete',
  'verified': 'Verified'
};

export function CardsSummary({ selectedProject, className }: CardsSummaryProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  const { data: summary = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/cards/summary', selectedProject],
    queryFn: () => 
      fetch(`/api/cards/summary${selectedProject ? `?project=${encodeURIComponent(selectedProject)}` : ''}`)
        .then(res => res.json()) as Promise<CardSummary[]>
  });

  // Listen for WebSocket updates to refresh summary
  useWebSocket({
    onMessage: (message: any) => {
      if (['CARD_CREATED', 'CARD_UPDATED', 'CARD_DELETED', 'CARDS_BULK_DELETED'].includes(message.type)) {
        queryClient.invalidateQueries({ queryKey: ['/api/cards/summary'] });
      }
    }
  });

  // Group cards by status
  const groupedCards = summary.reduce((acc, card) => {
    if (!acc[card.status]) {
      acc[card.status] = [];
    }
    acc[card.status].push(card);
    return acc;
  }, {} as Record<string, CardSummary[]>);

  // Sort cards within each status by order
  Object.keys(groupedCards).forEach(status => {
    groupedCards[status].sort((a, b) => parseInt(a.order) - parseInt(b.order));
  });

  const downloadMarkdown = async () => {
    try {
      const response = await fetch(`/api/cards/summary/markdown${selectedProject ? `?project=${encodeURIComponent(selectedProject)}` : ''}`);
      const markdown = await response.text();
      
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cards-summary${selectedProject ? `-${selectedProject.toLowerCase().replace(/\s+/g, '-')}` : ''}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download markdown:', error);
    }
  };

  const totalCards = summary.length;

  if (!isVisible) {
    return (
      <div className={`fixed top-4 right-4 z-50 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="shadow-lg"
        >
          <Eye className="h-4 w-4 mr-2" />
          Show Summary
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed top-4 right-4 z-50 w-80 ${className}`}>
      <Card className="shadow-lg border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Cards Summary
              {totalCards > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalCards}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadMarkdown}
                className="h-8 w-8 p-0"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
                className="h-8 w-8 p-0"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {selectedProject && (
            <p className="text-sm text-muted-foreground">
              Project: {selectedProject}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : totalCards === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No cards found
            </p>
          ) : (
            Object.entries(groupedCards).map(([status, cards]) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    className={statusColors[status as keyof typeof statusColors]} 
                    variant="secondary"
                  >
                    {statusLabels[status as keyof typeof statusLabels] || status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {cards.map((card) => (
                    <div 
                      key={card.id}
                      className="text-sm p-2 rounded border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-medium truncate" title={card.title}>
                        {card.title}
                      </div>
                      {card.project && card.project !== selectedProject && (
                        <div className="text-xs text-muted-foreground">
                          {card.project}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}