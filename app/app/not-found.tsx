import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-4xl font-bold mb-2" style={{ color: "var(--color-line)" }}>404</p>
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Page not found</p>
        <Link
          href="/"
          className="text-xs px-4 py-2 rounded"
          style={{ background: "var(--color-purple)", color: "white" }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
