import { KanbanBoard } from "@/components/kanban-board";

export default function Kanban() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban Board</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">Multi-Project Management</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <KanbanBoard />
      </main>
    </div>
  );
}
