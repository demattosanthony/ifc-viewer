import React from "react";
import type { PageMetadata } from "@ademattos/bunbox";
import "./index.css";
import { ThemeProvider } from "@ademattos/bunbox/theme";
import { ViewerProvider } from "ifc-viewer";

export const metadata: PageMetadata = {
  title: "ifc-viewer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ViewerProvider
        workerUrl="/worker.mjs"
        config={{
          gridEnabled: false,
          statsEnabled: true,
        }}
      >
        <main>{children}</main>
      </ViewerProvider>
    </ThemeProvider>
  );
}
