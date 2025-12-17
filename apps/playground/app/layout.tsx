import React from "react";
import type { PageMetadata } from "@ademattos/bunbox";
import "./index.css";
import { ThemeProvider } from "@ademattos/bunbox/theme";

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
      <main>{children}</main>
    </ThemeProvider>
  );
}
