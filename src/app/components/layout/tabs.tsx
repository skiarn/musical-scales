import React, { useState, useContext, createContext } from "react";
import "./tabs.css"; // CSS file we'll create

type TabsContextType = {
  value: string;
  setValue: (val: string) => void;
};

const TabsContext = createContext<TabsContextType | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={`tabs-container ${className || ""}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`tabs-list ${className || ""}`}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be inside Tabs");

  const isActive = ctx.value === value;

  return (
    <button
      className={`tabs-trigger ${isActive ? "active" : ""} ${
        className || ""
      }`}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be inside Tabs");

  if (ctx.value !== value) return null;

  return <div className={`tabs-content ${className || ""}`}>{children}</div>;
}
