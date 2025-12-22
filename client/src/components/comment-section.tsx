import { useState } from "react";
import { Comment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2, Edit3, Check, X } from "lucide-react";
import { formatCommentTime } from "@/lib/comment-utils";
import { cn } from "@/lib/utils";

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onUpdateComment?: (commentId: string, content: string) => void;
  isLoading?: boolean;
}

export function CommentSection({
  comments,
  onAddComment,
  onDeleteComment,
  onUpdateComment,
  isLoading = false,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment("");
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (editContent.trim() && onUpdateComment) {
      onUpdateComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-3">
        <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment List */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm italic">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 group"
            >
              {editingId === comment.id ? (
                // Edit mode
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, () => handleSaveEdit(comment.id))}
                    className="min-h-[60px] bg-white dark:bg-gray-800 text-sm"
                    autoFocus
                  />
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(comment.id)}
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="h-7 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      {comment.author && (
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {comment.author}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCommentTime(comment.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onUpdateComment && (
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          title="Edit comment"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Textarea
          placeholder="Add a comment... (Cmd/Ctrl + Enter to submit)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, handleSubmit)}
          className={cn(
            "min-h-[80px] bg-white dark:bg-gray-800 text-sm resize-none",
            "focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          )}
          disabled={isLoading}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isLoading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <MessageSquare className="w-3 h-3 mr-2" />
            {isLoading ? "Adding..." : "Add Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}



