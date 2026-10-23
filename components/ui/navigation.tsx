import { navigationItems, type NavigationId } from "@/lib/kit-content";

export interface NavigationProps {
  activeId?: NavigationId;
  onNavigate: (id: NavigationId) => void;
  label?: string;
}

export function Navigation({ activeId, onNavigate, label = "Меню фестиваля" }: NavigationProps) {
  return (
    <nav aria-label={label} className="kit-navigation flex items-center">
      {navigationItems.map((item) => (
        <button key={item.id} type="button" aria-pressed={activeId === item.id} className="kit-nav-item shrink-0" onClick={() => onNavigate(item.id)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
