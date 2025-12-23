import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, updateCardSchema, UpdateCard, KANBAN_STATUSES, KanbanStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { handleImageDrop, handleImagePaste, insertTextAtCursor } from "@/lib/image-upload-utils";
import { Loader2, Image as ImageIcon } from "lucide-react";

// Extended schema for editing (includes status field)
const editCardSchema = updateCardSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(KANBAN_STATUSES),
  link: z.string().url().optional().or(z.literal("")),
});

type EditCardForm = z.infer<typeof editCardSchema>;

interface EditCardDialogProps {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCardDialog({ card, open, onOpenChange }: EditCardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm<EditCardForm>({
    resolver: zodResolver(editCardSchema),
    defaultValues: {
      title: card.title,
      description: card.description,
      link: card.link || undefined,
      status: card.status as KanbanStatus,
      notes: card.notes || undefined,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditCardForm) => {
      const updates: UpdateCard = {
        ...data,
        link: data.link || null,
      };
      const response = await apiRequest("PATCH", `/api/cards/${card.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Card updated",
        description: "Your changes have been saved successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update card. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCardForm) => {
    updateMutation.mutate(data);
  };

  // Image upload handlers
  const handleImageUploadComplete = (markdown: string) => {
    const currentValue = form.getValues('description');
    const textarea = descriptionTextareaRef.current;
    
    if (textarea) {
      // Get cursor position
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      
      // Insert markdown at cursor position
      const newValue = currentValue.substring(0, start) + `\n${markdown}\n` + currentValue.substring(end);
      
      // Update form value
      form.setValue('description', newValue, { shouldDirty: true });
      
      // Set cursor position after inserted text
      setTimeout(() => {
        const newPos = start + markdown.length + 2;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback if no textarea ref - append to end
      form.setValue('description', currentValue + `\n${markdown}\n`, { shouldDirty: true });
    }
    
    setIsUploading(false);
    setIsDragging(false);
    toast({
      title: "Image uploaded",
      description: "Image has been added to the description.",
    });
  };

  const handleImageUploadError = (error: string) => {
    setIsUploading(false);
    setIsDragging(false);
    toast({
      title: "Upload failed",
      description: error,
      variant: "destructive",
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    setIsUploading(true);
    await handleImageDrop(
      e.nativeEvent,
      handleImageUploadComplete,
      handleImageUploadError
    );
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const hasImageData = Array.from(e.clipboardData.items).some(item => item.type.startsWith('image/'));
    if (hasImageData) {
      setIsUploading(true);
      await handleImagePaste(
        e.nativeEvent,
        handleImageUploadComplete,
        handleImageUploadError
      );
    }
  };

  const getStatusLabel = (status: KanbanStatus) => {
    const labels = {
      "not-started": "Not Started",
      "blocked": "Blocked",
      "in-progress": "In Progress",
      "complete": "Complete",
      "verified": "Verified"
    };
    return labels[status];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
          <DialogDescription>
            Modify the card details below. All fields support rich formatting.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter card title" 
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Description</span>
                    {isUploading && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading image...
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea 
                        placeholder="Enter card description (Markdown supported)\n\n💡 Tip: Drag & drop or paste images directly!"
                        className={`min-h-[150px] resize-y bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 transition-colors ${
                          isDragging ? 'border-blue-500 dark:border-blue-400 border-2 bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onPaste={onPaste}
                        disabled={isUploading}

                        {...field}
                        ref={(e) => {
                          field.ref(e);
                          (descriptionTextareaRef as any).current = e;
                        }}
                      />
                      {isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 rounded-md pointer-events-none">
                          <div className="text-center">
                            <ImageIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Drop image to upload</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Supports Markdown formatting. Drop or paste images to upload automatically.
                  </p>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com" 
                      type="url"
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional notes or context..."
                      className="min-h-[100px] resize-y bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {KANBAN_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-6 border-t border-gray-200 dark:border-gray-700 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateMutation.isPending ? "Updating..." : "Update Card"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}