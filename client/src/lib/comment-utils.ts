import { Comment } from "@shared/schema";
import { nanoid } from "nanoid";

/**
 * Parse comments JSON string into Comment array
 * Handles invalid JSON gracefully by returning empty array
 */
export function parseComments(commentsJson: string | null | undefined): Comment[] {
  if (!commentsJson) return [];
  
  try {
    const parsed = JSON.parse(commentsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse comments:", error);
    return [];
  }
}

/**
 * Serialize Comment array to JSON string
 */
export function serializeComments(comments: Comment[]): string {
  return JSON.stringify(comments);
}

/**
 * Create a new comment object
 */
export function createComment(content: string, author?: string): Comment {
  return {
    id: nanoid(),
    content,
    timestamp: new Date().toISOString(),
    author,
  };
}

/**
 * Add a new comment to the comments array
 */
export function addComment(
  existingComments: Comment[],
  content: string,
  author?: string
): Comment[] {
  const newComment = createComment(content, author);
  return [...existingComments, newComment];
}

/**
 * Delete a comment by ID
 */
export function deleteComment(comments: Comment[], commentId: string): Comment[] {
  return comments.filter((comment) => comment.id !== commentId);
}

/**
 * Update a comment by ID
 */
export function updateComment(
  comments: Comment[],
  commentId: string,
  newContent: string
): Comment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, content: newContent, timestamp: new Date().toISOString() }
      : comment
  );
}

/**
 * Sort comments by timestamp (newest first by default)
 */
export function sortComments(comments: Comment[], ascending = false): Comment[] {
  return [...comments].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Format timestamp for display
 */
export function formatCommentTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older comments, show the date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}



