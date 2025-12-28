import React from "react";
import type { PageMetadata } from "@ademattos/bunbox";
import { ViewerProvider } from "ifc-viewer";
import "./index.css";
import "@xterm/xterm/css/xterm.css";

export const metadata: PageMetadata = {
  title: "IFC Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewerProvider
      config={{
        gridEnabled: false,
        statsEnabled: true,
      }}
    >
      <main>{children}</main>
    </ViewerProvider>
  );
}
