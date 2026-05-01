import { ArcadiaLogo } from "@/components/ArcadiaLogo";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-elevated max-w-md rounded-lg p-8 text-center">
        <ArcadiaLogo className="mx-auto mb-4 h-10 w-10" />
        <p className="mb-2 type-label text-primary">Arcadia</p>
        <h1 className="mb-3 font-display type-h1 font-semibold">404</h1>
        <p className="mb-5 type-body text-muted-foreground">Page not found.</p>
        <a href="/" className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color] hover:bg-primary-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Return home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
