import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passcode.length !== 4) {
      setError("Passcode must be 4 digits");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Access granted",
          description: "Welcome to the Kanban board!",
        });
        onLogin();
      } else {
        setError(data.message || "Invalid passcode");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPasscode(value);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Required</CardTitle>
          <CardDescription>
            Enter the 4-digit passcode to access the Kanban board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                data-testid="input-passcode"
                type="text"
                inputMode="numeric"
                placeholder="• • • •"
                value={passcode}
                onChange={handleInputChange}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={4}
                autoFocus
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription data-testid="text-error">{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <Button 
              data-testid="button-login"
              type="submit" 
              className="w-full" 
              disabled={isLoading || passcode.length !== 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Access Board"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              v{__APP_VERSION__}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}