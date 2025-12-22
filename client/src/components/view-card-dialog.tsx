import { Card, Comment } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Copy, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CommentSection } from "./comment-section";
import { parseComments, serializeComments, addComment, deleteComment, updateComment, sortComments } from "@/lib/comment-utils";

interface ViewCardDialogProps {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCard?: (card: Card) => void;
}

export function ViewCardDialog({ card, open, onOpenChange, onEditCard }: ViewCardDialogProps) {
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse comments from card
  const comments = sortComments(parseComments(card.comments));

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

  // Comment mutations
  const updateCardComments = useMutation({
    mutationFn: async (newComments: Comment[]) => {
      console.log("Adding comment - card ID:", card.id);
      console.log("New comments:", newComments);
      console.log("Serialized:", serializeComments(newComments));
      
      const response = await apiRequest("PATCH", `/api/cards/${card.id}`, {
        comments: serializeComments(newComments)
      });
      return response.json();
    },
    onSuccess: () => {
      console.log("Comment mutation successful!");
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Success",
        description: "Comment updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Comment error:", error);
      toast({
        title: "Error",
        description: `Failed to update comments: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleAddComment = (content: string) => {
    console.log("handleAddComment called with:", content);
    console.log("Current comments:", comments);
    
    try {
      const newComments = addComment(comments, content);
      console.log("New comments array:", newComments);
      updateCardComments.mutate(newComments);
    } catch (error) {
      console.error("Error in handleAddComment:", error);
      toast({
        title: "Error",
        description: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    const newComments = deleteComment(comments, commentId);
    updateCardComments.mutate(newComments);
    toast({
      title: "Comment deleted",
      description: "The comment has been removed.",
    });
  };

  const handleUpdateComment = (commentId: string, content: string) => {
    const newComments = updateComment(comments, commentId, content);
    updateCardComments.mutate(newComments);
    toast({
      title: "Comment updated",
      description: "Your comment has been updated.",
    });
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
        
        <div className="overflow-y-auto flex-1 max-h-[60vh] px-1 space-y-4">
          {/* Description Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
            {card.description ? (
              <div className="text-sm text-gray-600 break-words prose prose-sm max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Use the same clean styling as InteractiveMarkdown
                    p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-700 dark:text-gray-300">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-2">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4">{children}</ol>,
                    li: ({ children }) => <li className="mb-1 ml-4 text-sm text-gray-700 dark:text-gray-300">{children}</li>,
                    code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm text-gray-800 dark:text-gray-200">{children}</code>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
                    h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-1 my-2 italic bg-gray-50 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300">{children}</blockquote>,
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                      >
                        {children}
                      </a>
                    ),
                    pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-2 text-sm">{children}</pre>,
                  }}
                >
                  {card.description}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic text-center py-4">
                No description provided
              </div>
            )}
          </div>

          {/* Notes Section */}
          {card.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{card.notes}</p>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="border-t-2 border-blue-200 dark:border-blue-800 pt-4 mt-4">
            <CommentSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onUpdateComment={handleUpdateComment}
              isLoading={updateCardComments.isPending}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}