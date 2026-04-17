import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Download, Edit, Trash2, FileText, FileJson, FileCode, X } from "lucide-react";
import { SimpleMarkdown } from "@/components/simple-markdown";
import type { ReleaseNote } from "@shared/schema";

interface ReleaseNotesPanelProps {
  selectedProject?: string;
}

export function ReleaseNotesPanel({ selectedProject }: ReleaseNotesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ReleaseNote | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    version: "",
    author: "",
    project: selectedProject || "",
    tags: "",
    storyReferences: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available projects to ensure consistency with kanban board
  const { data: projects = [] } = useQuery<string[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    }
  });

  // Fetch release notes
  const { data: notes = [], isLoading } = useQuery<ReleaseNote[]>({
    queryKey: ['/api/release-notes', selectedProject],
    queryFn: async () => {
      const url = selectedProject 
        ? `/api/release-notes?project=${encodeURIComponent(selectedProject)}`
        : '/api/release-notes';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch release notes');
      return res.json();
    }
  });

  // Search release notes
  const { data: searchResults } = useQuery<ReleaseNote[]>({
    queryKey: ['/api/release-notes/search', searchQuery, selectedProject],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const url = selectedProject
        ? `/api/release-notes/search?q=${encodeURIComponent(searchQuery)}&project=${encodeURIComponent(selectedProject)}`
        : `/api/release-notes/search?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to search release notes');
      return res.json();
    },
    enabled: searchQuery.trim().length > 0
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        title: data.title,
        content: data.content,
        project: data.project || selectedProject || "default",
        version: data.version || undefined,
        author: data.author || undefined,
        tags: data.tags ? data.tags : undefined,
        storyReferences: data.storyReferences ? data.storyReferences : undefined
      };

      const res = await fetch('/api/release-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create release note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/release-notes'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Release note created",
        description: "The release note has been created successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create release note",
        variant: "destructive"
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload: any = {
        title: data.title,
        content: data.content,
        version: data.version || undefined,
        author: data.author || undefined,
        tags: data.tags ? data.tags : undefined,
        storyReferences: data.storyReferences ? data.storyReferences : undefined
      };

      const res = await fetch(`/api/release-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update release note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/release-notes'] });
      setIsEditDialogOpen(false);
      setSelectedNote(null);
      resetForm();
      toast({
        title: "Release note updated",
        description: "The release note has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update release note",
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/release-notes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete release note');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/release-notes'] });
      setIsViewDialogOpen(false);
      setSelectedNote(null);
      toast({
        title: "Release note deleted",
        description: "The release note has been deleted successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete release note",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      version: "",
      author: "",
      project: selectedProject || "",
      tags: "",
      storyReferences: ""
    });
  };

  const handleCreate = () => {
    if (!formData.title || !formData.content) {
      toast({
        title: "Validation error",
        description: "Title and content are required",
        variant: "destructive"
      });
      return;
    }
    if (!selectedProject && !formData.project) {
      toast({
        title: "Validation error",
        description: "Project is required. Please select a project from the dropdown.",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedNote || !formData.title || !formData.content) {
      toast({
        title: "Validation error",
        description: "Title and content are required",
        variant: "destructive"
      });
      return;
    }
    updateMutation.mutate({ id: selectedNote.id, data: formData });
  };

  const handleEdit = (note: ReleaseNote) => {
    setSelectedNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      version: note.version || "",
      author: note.author || "",
      project: note.project,
      tags: note.tags || "",
      storyReferences: note.storyReferences || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleView = (note: ReleaseNote) => {
    setSelectedNote(note);
    setIsViewDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this release note?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = async (format: 'text' | 'markdown' | 'json') => {
    try {
      const url = selectedProject
        ? `/api/release-notes/export/${format}?project=${encodeURIComponent(selectedProject)}`
        : `/api/release-notes/export/${format}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to export');
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `release-notes-${selectedProject || 'all'}-${Date.now()}.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Export successful",
        description: `Release notes exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export release notes",
        variant: "destructive"
      });
    }
  };

  const displayNotes = searchQuery.trim() ? searchResults : notes;

  const parseStoryReferences = (refs: string | null) => {
    if (!refs) return [];
    try {
      return JSON.parse(refs);
    } catch {
      return [];
    }
  };

  const parseTags = (tags: string | null) => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  const formatProjectName = (project: string) => {
    return project
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="mb-4 bg-white dark:bg-gray-900">
        {selectedProject ? (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Viewing project:</span> {formatProjectName(selectedProject)}
            </p>
          </div>
        ) : (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Viewing:</span> All Projects
            </p>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Note
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto !bg-white dark:!bg-gray-900 border-gray-200 dark:border-gray-700">
                <DialogHeader>
                  <DialogTitle>Create Release Note</DialogTitle>
                  <DialogDescription>
                    Add a new release note with markdown formatting support
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Release title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="version">Version</Label>
                    <Input
                      id="version"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="e.g., 1.0.0, v2.1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="author">Author</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Author name"
                    />
                  </div>
                  {!selectedProject && (
                    <div>
                      <Label htmlFor="project">Project *</Label>
                      <Select
                        value={formData.project}
                        onValueChange={(value) => setFormData({ ...formData, project: value })}
                      >
                        <SelectTrigger id="project">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-gray-500">
                              No projects available. Create a card in the kanban board first.
                            </div>
                          ) : (
                            projects.map((project) => (
                              <SelectItem key={project} value={project}>
                                {formatProjectName(project)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Projects are shared with the kanban board
                      </p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="content">Content * (Markdown supported)</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Release notes content in markdown..."
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags (JSON array)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder='["feature", "bugfix"]'
                    />
                  </div>
                  <div>
                    <Label htmlFor="storyReferences">Story References (JSON array)</Label>
                    <Textarea
                      id="storyReferences"
                      value={formData.storyReferences}
                      onChange={(e) => setFormData({ ...formData, storyReferences: e.target.value })}
                      placeholder='[{"id": "STORY-123", "url": "https://..."}]'
                      rows={3}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={() => handleExport('text')}>
              <FileText className="h-4 w-4 mr-1" />
              Text
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('markdown')}>
              <FileCode className="h-4 w-4 mr-1" />
              Markdown
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <FileJson className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search release notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4 bg-white dark:bg-gray-900">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-white dark:bg-gray-900">
            Loading release notes...
          </div>
        ) : displayNotes && displayNotes.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-white dark:bg-gray-900">
            {searchQuery ? "No release notes found matching your search" : "No release notes yet"}
          </div>
        ) : (
          <div className="space-y-4 bg-white dark:bg-gray-900">
            {displayNotes?.map((note) => (
              <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1" onClick={() => handleView(note)}>
                      <CardTitle className="text-lg">
                        {note.title}
                        {note.version && (
                          <Badge variant="secondary" className="ml-2">
                            {note.version}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {note.author && <span>By {note.author} • </span>}
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        {note.project && (
                          <Badge variant="outline" className="ml-2">
                            {formatProjectName(note.project)}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(note);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(note.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => handleView(note)}>
                  <div className="line-clamp-3">
                    <SimpleMarkdown content={note.content.substring(0, 200) + '...'} className="text-sm text-gray-600 dark:text-gray-400" />
                  </div>
                  {parseTags(note.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {parseTags(note.tags).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto !bg-white dark:!bg-gray-900 border-gray-200 dark:border-gray-700">
          {selectedNote && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedNote.title}
                  {selectedNote.version && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedNote.version}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedNote.author && <span>By {selectedNote.author} • </span>}
                  Created: {new Date(selectedNote.createdAt).toLocaleString()}
                  {selectedNote.updatedAt !== selectedNote.createdAt && (
                    <span> • Updated: {new Date(selectedNote.updatedAt).toLocaleString()}</span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="prose dark:prose-invert max-w-none">
                <SimpleMarkdown content={selectedNote.content} />
              </div>
              {parseStoryReferences(selectedNote.storyReferences).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Related Stories:</h4>
                    <ul className="space-y-1">
                      {parseStoryReferences(selectedNote.storyReferences).map((ref: any, idx: number) => (
                        <li key={idx}>
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {ref.id}
                            {ref.title && ` - ${ref.title}`}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
              {parseTags(selectedNote.tags).length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {parseTags(selectedNote.tags).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto !bg-white dark:!bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Edit Release Note</DialogTitle>
            <DialogDescription>
              Update the release note with markdown formatting support
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-version">Version</Label>
              <Input
                id="edit-version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-author">Author</Label>
              <Input
                id="edit-author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content * (Markdown supported)</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="edit-tags">Tags (JSON array)</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-storyReferences">Story References (JSON array)</Label>
              <Textarea
                id="edit-storyReferences"
                value={formData.storyReferences}
                onChange={(e) => setFormData({ ...formData, storyReferences: e.target.value })}
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
