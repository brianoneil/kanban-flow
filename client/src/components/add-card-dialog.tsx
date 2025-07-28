import { useState } from "react";
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

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string;
}

export function AddCardDialog({ open, onOpenChange, project }: AddCardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCard>({
    resolver: zodResolver(insertCardSchema),
    defaultValues: {
      title: "",
      description: "",
      link: "",
      status: "not-started",
      project,
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
        link: "",
        status: "not-started",
        project: project,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
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
                    <Input placeholder="Enter card title" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter card description"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                      {...field}
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {KANBAN_STATUSES.map(status => (
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
            
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCardMutation.isPending}
                className="flex-1"
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
