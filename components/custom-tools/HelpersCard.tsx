import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export interface HelpersCardProps {
  activeTab: 'scraper' | 'implementation';
  onTabChange: (tab: 'scraper' | 'implementation') => void;
  className?: string;
  renderTabContent: (activeTab: 'scraper' | 'implementation') => React.ReactNode;
}

export const HelpersCard: React.FC<HelpersCardProps> = ({
  activeTab,
  onTabChange,
  className = "",
  renderTabContent,
}) => {
  return (
    <Card className={`bg-slate-700 shadow-xl border-slate-600 border overflow-hidden ${className}`}>
      <CardHeader className="bg-gradient-to-r from-slate-700 to-purple-900 pb-3">
        <CardTitle className="text-purple-300 text-lg flex items-center">
          <span className="mr-2">🧰</span> Helpers
        </CardTitle>
        <CardDescription className="text-gray-200">Tools to assist with custom tool creation</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-slate-600">
          <div className="flex">
            <button
              onClick={() => onTabChange('scraper')}
              className={`px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-150 ${
                activeTab === 'scraper'
                  ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/20'
                  : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent hover:border-gray-400/50'
              }`}
              aria-current={activeTab === 'scraper' ? 'page' : undefined}
            >
              Scraper Consultant
            </button>
            <button
              onClick={() => onTabChange('implementation')}
              className={`px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-150 ${
                activeTab === 'implementation'
                  ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/20'
                  : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent hover:border-gray-400/50'
              }`}
              aria-current={activeTab === 'implementation' ? 'page' : undefined}
            >
              Implementation Consultant
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {renderTabContent(activeTab)}
        </div>
      </CardContent>
    </Card>
  );
};