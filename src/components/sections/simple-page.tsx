import type { ReactNode } from "react";

interface SimplePageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SimplePage({ title, subtitle, children }: SimplePageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-8">
      <h1 className="text-display-md text-text-primary">{title}</h1>
      {subtitle ? (
        <p className="mt-2 text-body-lg text-text-secondary">{subtitle}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-5 text-body-md text-text-secondary [&_h2]:mt-4 [&_h2]:text-heading-lg [&_h2]:text-text-primary [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-6 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6">
        {children}
      </div>
    </div>
  );
}
