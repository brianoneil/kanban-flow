import { Card } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Copy, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ViewCardDialogProps {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCard?: (card: Card) => void;
}

export function ViewCardDialog({ card, open, onOpenChange, onEditCard }: ViewCardDialogProps) {
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'not-started': 'Not Started',
      'blocked': 'Blocked',
      'in-progress': 'In Progress', 
      'complete': 'Complete',
      'verified': 'Verified'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'not-started': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'blocked': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'complete': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'verified': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      const content = [
        `# ${card.title}`,
        '',
        card.description || 'No description provided.',
        '',
        `**Status:** ${getStatusLabel(card.status)}`,
        card.link ? `**Link:** ${card.link}` : '',
        card.project ? `**Project:** ${card.project}` : ''
      ].filter(Boolean).join('\n');

      await navigator.clipboard.writeText(content);
      
      toast({
        title: "Copied to clipboard",
        description: "Card content has been copied as Markdown.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsCopying(false), 1000);
    }
  };

  const handleEdit = () => {
    onOpenChange(false);
    onEditCard?.(card);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                {card.title}
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 dark:text-gray-400 mt-2">
                Full card details and content
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge className={getStatusColor(card.status)}>
                {getStatusLabel(card.status)}
              </Badge>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              {card.link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(card.link!, '_blank')}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Link
                </Button>
              )}
              {card.project && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
                  {card.project}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200"
              >
                {isCopying ? (
                  <>
                    <Copy className="w-4 h-4 mr-2 animate-pulse" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              {onEditCard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800 text-green-700 dark:text-green-200"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 max-h-[60vh] px-1">
          <div className="prose prose-gray dark:prose-invert prose-lg max-w-none">
            {card.description ? (
              <div className="prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-blockquote:border-l-blue-500">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {card.description}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic text-center py-8">
                No description provided
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}