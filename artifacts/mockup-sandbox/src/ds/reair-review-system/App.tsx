import { useEffect, useState, type ComponentType } from "react";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

const modules = import.meta.glob("./mockups/**/*.tsx") as ModuleMap;

function previewPath() {
  const path = window.location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return path || null;
}

function resolveComponent(
  module: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const candidates = Object.values(module).filter(
    (value) => typeof value === "function",
  ) as ComponentType[];

  return (
    (module.default as ComponentType) ||
    (module.Preview as ComponentType) ||
    (module[name] as ComponentType) ||
    candidates.at(-1)
  );
}

export default function App() {
  const [path, setPath] = useState<string | null>(previewPath);
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setPath(previewPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!path) {
      setComponent(null);
      setError(null);
      return;
    }

    const loader = modules[`./mockups/${path}.tsx`];
    if (!loader) {
      setError(`No Re-Air mockup found at ${path}.tsx`);
      setComponent(null);
      return;
    }

    setError(null);
    setComponent(null);
    void loader()
      .then((module) => {
        if (cancelled) return;
        const name = path.split("/").at(-1) ?? path;
        const resolved = resolveComponent(module, name);
        if (!resolved) {
          setError(`No React component is exported from ${path}.tsx`);
          return;
        }
        setComponent(() => resolved);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-8 text-foreground">
        <pre className="max-w-xl whitespace-pre-wrap font-mono text-sm text-destructive">
          {error}
        </pre>
      </main>
    );
  }

  if (Component) return <Component />;

  return (
    <main className="grid min-h-screen place-items-center bg-background p-8 text-foreground">
      <div className="max-w-md text-center">
        <p className="font-serif text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Re-Air Review System
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold">
          Canvas mockup entry
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Open a registered component from its canvas frame.
        </p>
      </div>
    </main>
  );
}