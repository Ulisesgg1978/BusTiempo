import React from 'react';
import { Map, Bus, Star, Bell } from 'lucide-react';

export type TabType = 'map' | 'routes' | 'favorites' | 'alerts';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  favoritesCount: number;
  activeAlertsCount: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  favoritesCount,
  activeAlertsCount,
}) => {
  const tabs = [
    {
      id: 'map' as TabType,
      label: 'Paradas GPS',
      icon: Map,
    },
    {
      id: 'routes' as TabType,
      label: 'Líneas',
      icon: Bus,
    },
    {
      id: 'favorites' as TabType,
      label: 'Favoritos',
      icon: Star,
      badge: favoritesCount > 0 ? favoritesCount : null,
    },
    {
      id: 'alerts' as TabType,
      label: 'Alertas',
      icon: Bell,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/98 backdrop-blur-xl border-t border-slate-800/90 text-slate-400 flex items-center justify-around px-2 z-[600] safe-area-bottom shadow-2xl"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`tab-nav-${tab.id}`}
            onClick={() => onChangeTab(tab.id)}
            className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-95 ${
              isActive ? 'text-blue-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            {/* Active Pill background indicator */}
            <div
              className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
                isActive ? 'bg-blue-600/20 text-blue-400' : 'bg-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive && tab.id === 'favorites' ? 'fill-amber-400 text-amber-400' : ''
                }`}
              />
            </div>

            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              {tab.label}
            </span>

            {/* Notification Badge */}
            {tab.badge !== null && (
              <span className="absolute top-1 right-[22%] sm:right-[32%] px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] min-w-[16px] text-center shadow">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
