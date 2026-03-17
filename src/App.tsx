/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import TalongTab from './components/TalongTab';
import ManiTab from './components/ManiTab';
import PrintablesTab from './components/PrintablesTab';
import { Menu, ChevronDown } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState(localStorage.getItem('pgh_last_active_tab') || 'form-tool-content');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('pgh_last_active_tab', tab);
    setIsMenuOpen(false);
  };

  const tabs = [
    { id: 'form-tool-content', label: 'LAB NEEDS' },
    { id: 'third-tool', label: 'PRINTABLES' },
    { id: 'second-tool', label: 'SOON..' },
  ];

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'MENU';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Desktop Navigation */}
      <nav id="main-nav-bar" className="hidden md:flex ml-10 pb-0 items-end gap-1">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden px-5 pt-4 pb-2 relative" ref={menuRef}>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="mobile-menu-btn w-full flex items-center justify-between bg-[#334155] text-white px-4 py-3 rounded-xl shadow-lg font-bold text-sm transition-all active:scale-95 border-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Menu size={18} />
            <span>{activeTabLabel}</span>
          </div>
          <ChevronDown size={18} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {isMenuOpen && (
          <div className="absolute top-full left-5 right-5 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[1000] animate-slide-down">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full text-left px-5 py-4 text-sm font-bold transition-colors border-b border-gray-50 last:border-0 ${
                  activeTab === tab.id ? 'bg-[#334155] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <main>
        <div className={activeTab === 'form-tool-content' ? '' : 'hidden'}>
          <TalongTab />
        </div>
        <div className={activeTab === 'second-tool' ? '' : 'hidden'}>
          <ManiTab />
        </div>
        <div className={activeTab === 'third-tool' ? '' : 'hidden'}>
          <PrintablesTab />
        </div>
      </main>
    </div>
  );
}
