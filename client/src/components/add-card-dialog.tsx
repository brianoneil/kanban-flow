import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCardSchema, InsertCard } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { KANBAN_STATUSES } from "@shared/schema";
import { handleImageDrop, handleImagePaste, insertTextAtCursor } from "@/lib/image-upload-utils";
import { Loader2, Image as ImageIcon } from "lucide-react";

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string;
}

export function AddCardDialog({ open, onOpenChange, project }: AddCardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm<InsertCard>({
    resolver: zodResolver(insertCardSchema),
    defaultValues: {
      title: "",
      description: "",
      link: undefined,
      status: "not-started",
      project,
      notes: undefined,
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (cardData: InsertCard) => {
      const response = await apiRequest("POST", "/api/cards", cardData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", project] });
      toast({
        title: "Card created",
        description: "New card has been added to the board.",
      });
      form.reset({
        title: "",
        description: "",
        link: undefined,
        status: "not-started",
        project: project,
        notes: undefined,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to create card.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCard) => {
    createCardMutation.mutate({ ...data, project });
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

  const getStatusLabel = (status: string) => {
    const labels = {
      "not-started": "Not Started",
      "blocked": "Blocked",
      "in-progress": "In Progress", 
      "complete": "Complete",
      "verified": "Verified",
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add New Card</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter card title"
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
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
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <span>Description</span>
                    {isUploading && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading...
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        placeholder="Enter card description (Markdown supported)&#10;&#10;💡 Tip: Drag & drop or paste images directly!"
                        className={`min-h-[100px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 resize-none transition-colors ${
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
                    Supports Markdown. Drop or paste images to upload.
                  </p>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      type="url"
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes or context..."
                      className="min-h-[80px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 resize-none"
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
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      {KANBAN_STATUSES.map(status => (
                        <SelectItem
                          key={status}
                          value={status}
                          className="hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                        >
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCardMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createCardMutation.isPending ? "Creating..." : "Create Card"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
