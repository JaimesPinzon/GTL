import React from "react";

const SettingsActionBar = ({
  items = [],
  activeItem = null,
  onSelectItem,
}) => {
  return (
    <div className="app-chrome border-b app-chrome-divider">
      <div className="flex min-h-12 w-full items-center gap-1 overflow-x-auto px-4 py-1.5 md:px-6">
        {items.map((item) => {
          const itemValue = typeof item === "string" ? item : item.value;
          const itemLabel = typeof item === "string" ? item : item.label;
          const isActive = itemValue === activeItem;

          return (
            <button
              key={itemValue}
              type="button"
              onClick={() => onSelectItem?.(itemValue)}
              className={`inline-flex h-9 shrink-0 items-center rounded-xl px-4 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-primary/14 text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              {itemLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsActionBar;
