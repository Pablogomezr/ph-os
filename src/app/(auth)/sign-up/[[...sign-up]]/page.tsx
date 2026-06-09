import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Propiedad Horizontal OS</h1>
          <p className="text-muted-foreground text-sm mt-1">Crear cuenta</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-border shadow-xl",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "bg-secondary border-border text-foreground hover:bg-secondary/80",
              formFieldLabel: "text-foreground",
              formFieldInput: "bg-input border-border text-foreground",
              footerActionLink: "text-primary",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
            },
          }}
        />
      </div>
    </div>
  );
}
